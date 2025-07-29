"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = __importDefault(require("node:assert"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const debounce_1 = __importDefault(require("debounce"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const zigbee_herdsman_1 = require("zigbee-herdsman");
const device_1 = __importDefault(require("../model/device"));
const group_1 = __importDefault(require("../model/group"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importDefault(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
const TOPIC_REGEX = new RegExp(`^${settings.get().mqtt.base_topic}/bridge/request/device/(bind|unbind)`);
const ALL_CLUSTER_CANDIDATES = [
    "genScenes",
    "genOnOff",
    "genLevelCtrl",
    "lightingColorCtrl",
    "closuresWindowCovering",
    "hvacThermostat",
    "msIlluminanceMeasurement",
    "msTemperatureMeasurement",
    "msRelativeHumidity",
    "msSoilMoisture",
    "msCO2",
];
// See zigbee-herdsman-converters
const DEFAULT_BIND_GROUP = { type: "group_number", ID: 901, name: "default_bind_group" };
const DEFAULT_REPORT_CONFIG = { minimumReportInterval: 5, maximumReportInterval: 3600, reportableChange: 1 };
const getColorCapabilities = async (endpoint) => {
    if (endpoint.getClusterAttributeValue("lightingColorCtrl", "colorCapabilities") == null) {
        await endpoint.read("lightingColorCtrl", ["colorCapabilities"]);
    }
    const value = endpoint.getClusterAttributeValue("lightingColorCtrl", "colorCapabilities");
    return {
        colorTemperature: (value & (1 << 4)) > 0,
        colorXY: (value & (1 << 3)) > 0,
    };
};
const REPORT_CLUSTERS = {
    genOnOff: [{ attribute: "onOff", ...DEFAULT_REPORT_CONFIG, minimumReportInterval: 0, reportableChange: 0 }],
    genLevelCtrl: [{ attribute: "currentLevel", ...DEFAULT_REPORT_CONFIG }],
    lightingColorCtrl: [
        {
            attribute: "colorTemperature",
            ...DEFAULT_REPORT_CONFIG,
            condition: async (endpoint) => (await getColorCapabilities(endpoint)).colorTemperature,
        },
        {
            attribute: "currentX",
            ...DEFAULT_REPORT_CONFIG,
            condition: async (endpoint) => (await getColorCapabilities(endpoint)).colorXY,
        },
        {
            attribute: "currentY",
            ...DEFAULT_REPORT_CONFIG,
            condition: async (endpoint) => (await getColorCapabilities(endpoint)).colorXY,
        },
    ],
    closuresWindowCovering: [
        { attribute: "currentPositionLiftPercentage", ...DEFAULT_REPORT_CONFIG },
        { attribute: "currentPositionTiltPercentage", ...DEFAULT_REPORT_CONFIG },
    ],
};
const POLL_ON_MESSAGE = [
    {
        // On messages that have the cluster and type of below
        cluster: {
            manuSpecificPhilips: [
                { type: "commandHueNotification", data: { button: 2 } },
                { type: "commandHueNotification", data: { button: 3 } },
            ],
            genLevelCtrl: [
                { type: "commandStep", data: {} },
                { type: "commandStepWithOnOff", data: {} },
                { type: "commandStop", data: {} },
                { type: "commandMoveWithOnOff", data: {} },
                { type: "commandStopWithOnOff", data: {} },
                { type: "commandMove", data: {} },
                { type: "commandMoveToLevelWithOnOff", data: {} },
            ],
            genScenes: [{ type: "commandRecall", data: {} }],
        },
        // Read the following attributes
        read: { cluster: "genLevelCtrl", attributes: ["currentLevel"] },
        // When the bound devices/members of group have the following manufacturerIDs
        manufacturerIDs: [
            zigbee_herdsman_1.Zcl.ManufacturerCode.SIGNIFY_NETHERLANDS_B_V,
            zigbee_herdsman_1.Zcl.ManufacturerCode.ATMEL,
            zigbee_herdsman_1.Zcl.ManufacturerCode.GLEDOPTO_CO_LTD,
            zigbee_herdsman_1.Zcl.ManufacturerCode.MUELLER_LICHT_INTERNATIONAL_INC,
            zigbee_herdsman_1.Zcl.ManufacturerCode.TELINK_MICRO,
            zigbee_herdsman_1.Zcl.ManufacturerCode.BUSCH_JAEGER_ELEKTRO,
        ],
        manufacturerNames: ["GLEDOPTO", "Trust International B.V.\u0000"],
    },
    {
        cluster: {
            genLevelCtrl: [
                { type: "commandStepWithOnOff", data: {} },
                { type: "commandMoveWithOnOff", data: {} },
                { type: "commandStopWithOnOff", data: {} },
                { type: "commandMoveToLevelWithOnOff", data: {} },
            ],
            genOnOff: [
                { type: "commandOn", data: {} },
                { type: "commandOff", data: {} },
                { type: "commandOffWithEffect", data: {} },
                { type: "commandToggle", data: {} },
            ],
            genScenes: [{ type: "commandRecall", data: {} }],
            manuSpecificPhilips: [
                { type: "commandHueNotification", data: { button: 1 } },
                { type: "commandHueNotification", data: { button: 4 } },
            ],
        },
        read: { cluster: "genOnOff", attributes: ["onOff"] },
        manufacturerIDs: [
            zigbee_herdsman_1.Zcl.ManufacturerCode.SIGNIFY_NETHERLANDS_B_V,
            zigbee_herdsman_1.Zcl.ManufacturerCode.ATMEL,
            zigbee_herdsman_1.Zcl.ManufacturerCode.GLEDOPTO_CO_LTD,
            zigbee_herdsman_1.Zcl.ManufacturerCode.MUELLER_LICHT_INTERNATIONAL_INC,
            zigbee_herdsman_1.Zcl.ManufacturerCode.TELINK_MICRO,
            zigbee_herdsman_1.Zcl.ManufacturerCode.BUSCH_JAEGER_ELEKTRO,
        ],
        manufacturerNames: ["GLEDOPTO", "Trust International B.V.\u0000"],
    },
    {
        cluster: {
            genScenes: [{ type: "commandRecall", data: {} }],
        },
        read: {
            cluster: "lightingColorCtrl",
            attributes: [],
            // Since not all devices support the same attributes they need to be calculated dynamically
            // depending on the capabilities of the endpoint.
            attributesForEndpoint: async (endpoint) => {
                const supportedAttrs = await getColorCapabilities(endpoint);
                const readAttrs = [];
                if (supportedAttrs.colorXY) {
                    readAttrs.push("currentX", "currentY");
                }
                if (supportedAttrs.colorTemperature) {
                    readAttrs.push("colorTemperature");
                }
                return readAttrs;
            },
        },
        manufacturerIDs: [
            zigbee_herdsman_1.Zcl.ManufacturerCode.SIGNIFY_NETHERLANDS_B_V,
            zigbee_herdsman_1.Zcl.ManufacturerCode.ATMEL,
            zigbee_herdsman_1.Zcl.ManufacturerCode.GLEDOPTO_CO_LTD,
            zigbee_herdsman_1.Zcl.ManufacturerCode.MUELLER_LICHT_INTERNATIONAL_INC,
            zigbee_herdsman_1.Zcl.ManufacturerCode.TELINK_MICRO,
            // Note: ManufacturerCode.BUSCH_JAEGER is left out intentionally here as their devices don't support colors
        ],
        manufacturerNames: ["GLEDOPTO", "Trust International B.V.\u0000"],
    },
];
class Bind extends extension_1.default {
    pollDebouncers = {};
    // biome-ignore lint/suspicious/useAwait: API
    async start() {
        this.eventBus.onDeviceMessage(this, this.poll);
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
        this.eventBus.onGroupMembersChanged(this, this.onGroupMembersChanged);
    }
    parseMQTTMessage(data) {
        if (data.topic.match(TOPIC_REGEX)) {
            const type = data.topic.endsWith("unbind") ? "unbind" : "bind";
            let skipDisableReporting = false;
            const message = JSON.parse(data.message);
            if (typeof message !== "object" || message.from == null || message.to == null) {
                return [message, { type, skipDisableReporting }, "Invalid payload"];
            }
            const sourceKey = message.from;
            const sourceEndpointKey = message.from_endpoint ?? "default";
            const targetKey = message.to;
            const targetEndpointKey = message.to_endpoint;
            const clusters = message.clusters;
            skipDisableReporting = message.skip_disable_reporting != null ? message.skip_disable_reporting : false;
            const resolvedSource = this.zigbee.resolveEntity(message.from);
            if (!resolvedSource || !(resolvedSource instanceof device_1.default)) {
                return [message, { type, skipDisableReporting }, `Source device '${message.from}' does not exist`];
            }
            const resolvedTarget = message.to === DEFAULT_BIND_GROUP.name || message.to === DEFAULT_BIND_GROUP.ID
                ? DEFAULT_BIND_GROUP
                : this.zigbee.resolveEntity(message.to);
            if (!resolvedTarget) {
                return [message, { type, skipDisableReporting }, `Target device or group '${message.to}' does not exist`];
            }
            const resolvedSourceEndpoint = resolvedSource.endpoint(sourceEndpointKey);
            if (!resolvedSourceEndpoint) {
                return [
                    message,
                    { type, skipDisableReporting },
                    `Source device '${resolvedSource.name}' does not have endpoint '${sourceEndpointKey}'`,
                ];
            }
            // resolves to 'default' endpoint if targetEndpointKey is invalid (used by frontend for 'Coordinator')
            const resolvedBindTarget = resolvedTarget instanceof device_1.default
                ? resolvedTarget.endpoint(targetEndpointKey)
                : resolvedTarget instanceof group_1.default
                    ? resolvedTarget.zh
                    : Number(resolvedTarget.ID);
            if (resolvedTarget instanceof device_1.default && !resolvedBindTarget) {
                return [
                    message,
                    { type, skipDisableReporting },
                    `Target device '${resolvedTarget.name}' does not have endpoint '${targetEndpointKey}'`,
                ];
            }
            return [
                message,
                {
                    type,
                    sourceKey,
                    sourceEndpointKey,
                    targetKey,
                    targetEndpointKey,
                    clusters,
                    skipDisableReporting,
                    resolvedSource,
                    resolvedTarget,
                    resolvedSourceEndpoint,
                    resolvedBindTarget,
                },
                undefined,
            ];
        }
        return [undefined, undefined, undefined];
    }
    async onMQTTMessage(data) {
        const [raw, parsed, error] = this.parseMQTTMessage(data);
        if (!raw || !parsed) {
            return;
        }
        if (error) {
            await this.publishResponse(parsed.type, raw, {}, error);
            return;
        }
        const { type, sourceKey, sourceEndpointKey, targetKey, targetEndpointKey, clusters, skipDisableReporting, resolvedSource, resolvedTarget, resolvedSourceEndpoint, resolvedBindTarget, } = parsed;
        (0, node_assert_1.default)(resolvedSource, "`resolvedSource` is missing");
        (0, node_assert_1.default)(resolvedTarget, "`resolvedTarget` is missing");
        (0, node_assert_1.default)(resolvedSourceEndpoint, "`resolvedSourceEndpoint` is missing");
        (0, node_assert_1.default)(resolvedBindTarget !== undefined, "`resolvedBindTarget` is missing");
        const successfulClusters = [];
        const failedClusters = [];
        const attemptedClusters = [];
        // Find which clusters are supported by both the source and target.
        // Groups are assumed to support all clusters.
        const clusterCandidates = clusters ?? ALL_CLUSTER_CANDIDATES;
        for (const cluster of clusterCandidates) {
            let matchingClusters = false;
            const anyClusterValid = utils_1.default.isZHGroup(resolvedBindTarget) ||
                typeof resolvedBindTarget === "number" ||
                (resolvedTarget instanceof device_1.default && resolvedTarget.zh.type === "Coordinator");
            if (!anyClusterValid && utils_1.default.isZHEndpoint(resolvedBindTarget)) {
                matchingClusters =
                    (resolvedBindTarget.supportsInputCluster(cluster) && resolvedSourceEndpoint.supportsOutputCluster(cluster)) ||
                        (resolvedSourceEndpoint.supportsInputCluster(cluster) && resolvedBindTarget.supportsOutputCluster(cluster));
            }
            const sourceValid = resolvedSourceEndpoint.supportsInputCluster(cluster) || resolvedSourceEndpoint.supportsOutputCluster(cluster);
            if (sourceValid && (anyClusterValid || matchingClusters)) {
                logger_1.default.debug(`${type}ing cluster '${cluster}' from '${resolvedSource.name}' to '${resolvedTarget.name}'`);
                attemptedClusters.push(cluster);
                try {
                    if (type === "bind") {
                        await resolvedSourceEndpoint.bind(cluster, resolvedBindTarget);
                    }
                    else {
                        await resolvedSourceEndpoint.unbind(cluster, resolvedBindTarget);
                    }
                    successfulClusters.push(cluster);
                    logger_1.default.info(`Successfully ${type === "bind" ? "bound" : "unbound"} cluster '${cluster}' from '${resolvedSource.name}' to '${resolvedTarget.name}'`);
                }
                catch (error) {
                    failedClusters.push(cluster);
                    logger_1.default.error(`Failed to ${type} cluster '${cluster}' from '${resolvedSource.name}' to '${resolvedTarget.name}' (${error})`);
                }
            }
        }
        if (attemptedClusters.length === 0) {
            logger_1.default.error(`Nothing to ${type} from '${resolvedSource.name}' to '${resolvedTarget.name}'`);
            await this.publishResponse(parsed.type, raw, {}, `Nothing to ${type}`);
            return;
        }
        if (failedClusters.length === attemptedClusters.length) {
            await this.publishResponse(parsed.type, raw, {}, `Failed to ${type}`);
            return;
        }
        const responseData = {
            // biome-ignore lint/style/noNonNullAssertion: valid with assert above on `resolvedSource`
            from: sourceKey,
            // biome-ignore lint/style/noNonNullAssertion: valid with assert above on `resolvedSourceEndpoint`
            from_endpoint: sourceEndpointKey,
            // biome-ignore lint/style/noNonNullAssertion: valid with assert above on `resolvedTarget`
            to: targetKey,
            to_endpoint: targetEndpointKey,
            clusters: successfulClusters,
            failed: failedClusters,
        };
        if (successfulClusters.length !== 0) {
            if (type === "bind") {
                await this.setupReporting(resolvedSourceEndpoint.binds.filter((b) => successfulClusters.includes(b.cluster.name) && b.target === resolvedBindTarget));
            }
            else if (typeof resolvedBindTarget !== "number" && !skipDisableReporting) {
                await this.disableUnnecessaryReportings(resolvedBindTarget);
            }
        }
        await this.publishResponse(parsed.type, raw, responseData);
        this.eventBus.emitDevicesChanged();
    }
    async publishResponse(type, request, data, error) {
        const response = utils_1.default.getResponse(request, data, error);
        await this.mqtt.publish(`bridge/response/device/${type}`, (0, json_stable_stringify_without_jsonify_1.default)(response));
        if (error) {
            logger_1.default.error(error);
        }
    }
    async onGroupMembersChanged(data) {
        if (data.action === "add") {
            const bindsToGroup = [];
            for (const device of this.zigbee.devicesIterator(utils_1.default.deviceNotCoordinator)) {
                for (const endpoint of device.zh.endpoints) {
                    for (const bind of endpoint.binds) {
                        if (bind.target === data.group.zh) {
                            bindsToGroup.push(bind);
                        }
                    }
                }
            }
            await this.setupReporting(bindsToGroup);
        }
        else {
            // action === remove/remove_all
            if (!data.skipDisableReporting) {
                await this.disableUnnecessaryReportings(data.endpoint);
            }
        }
    }
    getSetupReportingEndpoints(bind, coordinatorEp) {
        const endpoints = utils_1.default.isZHEndpoint(bind.target) ? [bind.target] : bind.target.members;
        return endpoints.filter((e) => {
            if (!e.supportsInputCluster(bind.cluster.name)) {
                return false;
            }
            const hasConfiguredReporting = e.configuredReportings.some((c) => c.cluster.name === bind.cluster.name);
            if (!hasConfiguredReporting) {
                return true;
            }
            const hasBind = e.binds.some((b) => b.cluster.name === bind.cluster.name && b.target === coordinatorEp);
            return !hasBind;
        });
    }
    async setupReporting(binds) {
        const coordinatorEndpoint = this.zigbee.firstCoordinatorEndpoint();
        for (const bind of binds) {
            if (bind.cluster.name in REPORT_CLUSTERS) {
                for (const endpoint of this.getSetupReportingEndpoints(bind, coordinatorEndpoint)) {
                    // biome-ignore lint/style/noNonNullAssertion: TODO: biome migration: ???
                    const resolvedDevice = this.zigbee.resolveEntity(endpoint.getDevice());
                    const entity = `${resolvedDevice.name}/${endpoint.ID}`;
                    try {
                        await endpoint.bind(bind.cluster.name, coordinatorEndpoint);
                        const items = [];
                        // biome-ignore lint/style/noNonNullAssertion: valid from outer `if`
                        for (const c of REPORT_CLUSTERS[bind.cluster.name]) {
                            if (!c.condition || (await c.condition(endpoint))) {
                                const i = { ...c };
                                delete i.condition;
                                items.push(i);
                            }
                        }
                        await endpoint.configureReporting(bind.cluster.name, items);
                        logger_1.default.info(`Successfully setup reporting for '${entity}' cluster '${bind.cluster.name}'`);
                    }
                    catch (error) {
                        logger_1.default.warning(`Failed to setup reporting for '${entity}' cluster '${bind.cluster.name}' (${error.message})`);
                    }
                }
            }
        }
        this.eventBus.emitDevicesChanged();
    }
    async disableUnnecessaryReportings(target) {
        const coordinator = this.zigbee.firstCoordinatorEndpoint();
        const endpoints = utils_1.default.isZHEndpoint(target) ? [target] : target.members;
        const allBinds = [];
        for (const device of this.zigbee.devicesIterator(utils_1.default.deviceNotCoordinator)) {
            for (const endpoint of device.zh.endpoints) {
                for (const bind of endpoint.binds) {
                    allBinds.push(bind);
                }
            }
        }
        for (const endpoint of endpoints) {
            const device = this.zigbee.resolveEntity(endpoint.getDevice());
            const entity = `${device.name}/${endpoint.ID}`;
            const requiredClusters = [];
            const boundClusters = [];
            for (const bind of allBinds) {
                if (utils_1.default.isZHEndpoint(bind.target) ? bind.target === endpoint : bind.target.members.includes(endpoint)) {
                    requiredClusters.push(bind.cluster.name);
                }
            }
            for (const b of endpoint.binds) {
                if (b.target === coordinator && !requiredClusters.includes(b.cluster.name) && b.cluster.name in REPORT_CLUSTERS) {
                    boundClusters.push(b.cluster.name);
                }
            }
            for (const cluster of boundClusters) {
                try {
                    await endpoint.unbind(cluster, coordinator);
                    const items = [];
                    // biome-ignore lint/style/noNonNullAssertion: valid from loop (pushed to array only if in)
                    for (const item of REPORT_CLUSTERS[cluster]) {
                        if (!item.condition || (await item.condition(endpoint))) {
                            const i = { ...item };
                            delete i.condition;
                            items.push({ ...i, maximumReportInterval: 0xffff });
                        }
                    }
                    await endpoint.configureReporting(cluster, items);
                    logger_1.default.info(`Successfully disabled reporting for '${entity}' cluster '${cluster}'`);
                }
                catch (error) {
                    logger_1.default.warning(`Failed to disable reporting for '${entity}' cluster '${cluster}' (${error.message})`);
                }
            }
            this.eventBus.emitReconfigure({ device });
        }
    }
    async poll(data) {
        /**
         * This method poll bound endpoints and group members for state changes.
         *
         * A use case is e.g. a Hue Dimmer switch bound to a Hue bulb.
         * Hue bulbs only report their on/off state.
         * When dimming the bulb via the dimmer switch the state is therefore not reported.
         * When we receive a message from a Hue dimmer we read the brightness from the bulb (if bound).
         */
        const polls = POLL_ON_MESSAGE.filter((p) => p.cluster[data.cluster]?.some((c) => c.type === data.type && utils_1.default.equalsPartial(data.data, c.data)));
        if (polls.length) {
            const toPoll = new Set();
            // Add bound devices
            for (const endpoint of data.device.zh.endpoints) {
                for (const bind of endpoint.binds) {
                    if (utils_1.default.isZHEndpoint(bind.target) && bind.target.getDevice().type !== "Coordinator") {
                        toPoll.add(bind.target);
                    }
                }
            }
            if (data.groupID && data.groupID !== 0) {
                // If message is published to a group, add members of the group
                const group = this.zigbee.groupByID(data.groupID);
                if (group) {
                    for (const member of group.zh.members) {
                        toPoll.add(member);
                    }
                }
            }
            for (const endpoint of toPoll) {
                const device = endpoint.getDevice();
                for (const poll of polls) {
                    if (
                    // biome-ignore lint/style/noNonNullAssertion: manufacturerID/manufacturerName can be undefined and won't match `includes`, but TS enforces same-type
                    (!poll.manufacturerIDs.includes(device.manufacturerID) && !poll.manufacturerNames.includes(device.manufacturerName)) ||
                        !endpoint.supportsInputCluster(poll.read.cluster)) {
                        continue;
                    }
                    let readAttrs = poll.read.attributes;
                    if (poll.read.attributesForEndpoint) {
                        const attrsForEndpoint = await poll.read.attributesForEndpoint(endpoint);
                        readAttrs = [...poll.read.attributes, ...attrsForEndpoint];
                    }
                    const key = `${device.ieeeAddr}_${endpoint.ID}_${POLL_ON_MESSAGE.indexOf(poll)}`;
                    if (!this.pollDebouncers[key]) {
                        this.pollDebouncers[key] = (0, debounce_1.default)(async () => {
                            try {
                                await endpoint.read(poll.read.cluster, readAttrs);
                            }
                            catch (error) {
                                // biome-ignore lint/style/noNonNullAssertion: TODO: biome migration: ???
                                const resolvedDevice = this.zigbee.resolveEntity(device);
                                logger_1.default.error(`Failed to poll ${readAttrs} from ${resolvedDevice.name} (${error.message})`);
                            }
                        }, 1000);
                    }
                    this.pollDebouncers[key]();
                }
            }
        }
    }
}
exports.default = Bind;
__decorate([
    bind_decorator_1.default
], Bind.prototype, "onMQTTMessage", null);
__decorate([
    bind_decorator_1.default
], Bind.prototype, "onGroupMembersChanged", null);
__decorate([
    bind_decorator_1.default
], Bind.prototype, "poll", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmluZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9leHRlbnNpb24vYmluZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhEQUFpQztBQUNqQyxvRUFBa0M7QUFDbEMsd0RBQWdDO0FBQ2hDLGtIQUE4RDtBQUM5RCxxREFBb0M7QUFFcEMsNkRBQXFDO0FBQ3JDLDJEQUFtQztBQUVuQyw0REFBb0M7QUFDcEMsMkRBQTZDO0FBQzdDLDBEQUFrQztBQUNsQyw0REFBb0M7QUFFcEMsTUFBTSxXQUFXLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsc0NBQXNDLENBQUMsQ0FBQztBQUN6RyxNQUFNLHNCQUFzQixHQUEyQjtJQUNuRCxXQUFXO0lBQ1gsVUFBVTtJQUNWLGNBQWM7SUFDZCxtQkFBbUI7SUFDbkIsd0JBQXdCO0lBQ3hCLGdCQUFnQjtJQUNoQiwwQkFBMEI7SUFDMUIsMEJBQTBCO0lBQzFCLG9CQUFvQjtJQUNwQixnQkFBZ0I7SUFDaEIsT0FBTztDQUNWLENBQUM7QUFFRixpQ0FBaUM7QUFDakMsTUFBTSxrQkFBa0IsR0FBRyxFQUFDLElBQUksRUFBRSxjQUFjLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsb0JBQW9CLEVBQUMsQ0FBQztBQUN2RixNQUFNLHFCQUFxQixHQUFHLEVBQUMscUJBQXFCLEVBQUUsQ0FBQyxFQUFFLHFCQUFxQixFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLEVBQUMsQ0FBQztBQUUzRyxNQUFNLG9CQUFvQixHQUFHLEtBQUssRUFBRSxRQUFxQixFQUEwRCxFQUFFO0lBQ2pILElBQUksUUFBUSxDQUFDLHdCQUF3QixDQUFDLG1CQUFtQixFQUFFLG1CQUFtQixDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7UUFDdEYs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