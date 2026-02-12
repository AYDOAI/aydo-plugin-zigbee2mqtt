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
const node_fs_1 = __importDefault(require("node:fs"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const jszip_1 = __importDefault(require("jszip"));
const object_assign_deep_1 = __importDefault(require("object-assign-deep"));
const winston_transport_1 = __importDefault(require("winston-transport"));
const zigbee_herdsman_1 = require("zigbee-herdsman");
const device_1 = require("zigbee-herdsman/dist/controller/model/device");
const zhc = __importStar(require("zigbee-herdsman-converters"));
const device_2 = __importDefault(require("../model/device"));
const data_1 = __importDefault(require("../util/data"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importStar(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
const REQUEST_REGEX = new RegExp(`${settings.get().mqtt.base_topic}/bridge/request/(.*)`);
class Bridge extends extension_1.default {
    // set on `start`
    #osInfo;
    zigbee2mqttVersion;
    zigbeeHerdsmanVersion;
    zigbeeHerdsmanConvertersVersion;
    coordinatorVersion;
    restartRequired = false;
    lastJoinedDeviceIeeeAddr;
    lastBridgeLoggingPayload;
    logTransport;
    requestLookup = {
        "device/options": this.deviceOptions,
        "device/configure_reporting": this.deviceConfigureReporting,
        "device/remove": this.deviceRemove,
        "device/interview": this.deviceInterview,
        "device/generate_external_definition": this.deviceGenerateExternalDefinition,
        "device/rename": this.deviceRename,
        "group/add": this.groupAdd,
        "group/options": this.groupOptions,
        "group/remove": this.groupRemove,
        "group/rename": this.groupRename,
        permit_join: this.permitJoin,
        restart: this.restart,
        backup: this.backup,
        "touchlink/factory_reset": this.touchlinkFactoryReset,
        "touchlink/identify": this.touchlinkIdentify,
        "install_code/add": this.installCodeAdd,
        "touchlink/scan": this.touchlinkScan,
        health_check: this.healthCheck,
        coordinator_check: this.coordinatorCheck,
        options: this.bridgeOptions,
    };
    async start() {
        const debugToMQTTFrontend = settings.get().advanced.log_debug_to_mqtt_frontend;
        const bridgeLogging = (message, level, namespace) => {
            const payload = (0, json_stable_stringify_without_jsonify_1.default)({ message, level, namespace });
            if (payload !== this.lastBridgeLoggingPayload) {
                this.lastBridgeLoggingPayload = payload;
                void this.mqtt.publish("bridge/logging", payload, { skipLog: true });
            }
        };
        if (debugToMQTTFrontend) {
            class DebugEventTransport extends winston_transport_1.default {
                log(info, next) {
                    bridgeLogging(info.message, info.level, info.namespace);
                    next();
                }
            }
            this.logTransport = new DebugEventTransport();
        }
        else {
            class EventTransport extends winston_transport_1.default {
                log(info, next) {
                    if (info.level !== "debug") {
                        bridgeLogging(info.message, info.level, info.namespace);
                    }
                    next();
                }
            }
            this.logTransport = new EventTransport();
        }
        logger_1.default.addTransport(this.logTransport);
        const os = await import("node:os");
        const process = await import("node:process");
        const logicalCpuCores = os.cpus();
        this.#osInfo = {
            version: `${os.version()} - ${os.release()} - ${os.arch()}`,
            node_version: process.version,
            cpus: `${[...new Set(logicalCpuCores.map((cpu) => cpu.model))].join(" | ")} (x${logicalCpuCores.length})`,
            memory_mb: Math.round(os.totalmem() / 1024 / 1024),
        };
        this.zigbee2mqttVersion = await utils_1.default.getZigbee2MQTTVersion();
        this.zigbeeHerdsmanVersion = await utils_1.default.getDependencyVersion("zigbee-herdsman");
        this.zigbeeHerdsmanConvertersVersion = await utils_1.default.getDependencyVersion("zigbee-herdsman-converters");
        this.coordinatorVersion = await this.zigbee.getCoordinatorVersion();
        this.eventBus.onEntityRenamed(this, async () => {
            await this.publishInfo();
        });
        this.eventBus.onGroupMembersChanged(this, async () => {
            await this.publishGroups();
        });
        this.eventBus.onDevicesChanged(this, async () => {
            await this.publishDevices();
            await this.publishInfo();
            await this.publishDefinitions();
        });
        this.eventBus.onPermitJoinChanged(this, async () => {
            if (!this.zigbee.isStopping()) {
                await this.publishInfo();
            }
        });
        this.eventBus.onScenesChanged(this, async () => {
            await this.publishDevices();
            await this.publishGroups();
        });
        // Zigbee events
        this.eventBus.onDeviceJoined(this, async (data) => {
            this.lastJoinedDeviceIeeeAddr = data.device.ieeeAddr;
            await this.publishDevices();
            const payload = {
                type: "device_joined",
                data: { friendly_name: data.device.name, ieee_address: data.device.ieeeAddr },
            };
            await this.mqtt.publish("bridge/event", (0, json_stable_stringify_without_jsonify_1.default)(payload));
        });
        this.eventBus.onDeviceLeave(this, async (data) => {
            await this.publishDevices();
            await this.publishDefinitions();
            const payload = { type: "device_leave", data: { ieee_address: data.ieeeAddr, friendly_name: data.name } };
            await this.mqtt.publish("bridge/event", (0, json_stable_stringify_without_jsonify_1.default)(payload));
        });
        this.eventBus.onDeviceNetworkAddressChanged(this, async () => {
            await this.publishDevices();
        });
        this.eventBus.onDeviceInterview(this, async (data) => {
            await this.publishDevices();
            let payload;
            if (data.status === "successful") {
                payload = {
                    type: "device_interview",
                    data: {
                        friendly_name: data.device.name,
                        status: data.status,
                        ieee_address: data.device.ieeeAddr,
                        supported: data.device.isSupported,
                        definition: this.getDefinitionPayload(data.device),
                    },
                };
            }
            else {
                payload = {
                    type: "device_interview",
                    data: { friendly_name: data.device.name, status: data.status, ieee_address: data.device.ieeeAddr },
                };
            }
            await this.mqtt.publish("bridge/event", (0, json_stable_stringify_without_jsonify_1.default)(payload));
        });
        this.eventBus.onDeviceAnnounce(this, async (data) => {
            await this.publishDevices();
            const payload = {
                type: "device_announce",
                data: { friendly_name: data.device.name, ieee_address: data.device.ieeeAddr },
            };
            await this.mqtt.publish("bridge/event", (0, json_stable_stringify_without_jsonify_1.default)(payload));
        });
        await this.publishInfo();
        await this.publishDevices();
        await this.publishGroups();
        await this.publishDefinitions();
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
    }
    async stop() {
        await super.stop();
        logger_1.default.removeTransport(this.logTransport);
    }
    async onMQTTMessage(data) {
        const match = data.topic.match(REQUEST_REGEX);
        if (!match) {
            return;
        }
        const key = match[1].toLowerCase();
        if (key in this.requestLookup) {
            const message = utils_1.default.parseJSON(data.message, data.message);
            try {
                const response = await this.requestLookup[key](message);
                await this.mqtt.publish(`bridge/response/${match[1]}`, (0, json_stable_stringify_without_jsonify_1.default)(response));
            }
            catch (error) {
                logger_1.default.error(`Request '${data.topic}' failed with error: '${error.message}'`);
                // biome-ignore lint/style/noNonNullAssertion: always using Error
                logger_1.default.debug(error.stack);
                const response = utils_1.default.getResponse(message, {}, error.message);
                await this.mqtt.publish(`bridge/response/${match[1]}`, (0, json_stable_stringify_without_jsonify_1.default)(response));
            }
        }
    }
    /**
     * Requests
     */
    async deviceOptions(message) {
        return await this.changeEntityOptions("device", message);
    }
    async groupOptions(message) {
        return await this.changeEntityOptions("group", message);
    }
    async bridgeOptions(message) {
        if (typeof message !== "object" || typeof message.options !== "object") {
            throw new Error("Invalid payload");
        }
        const newSettings = message.options;
        this.restartRequired = settings.apply(newSettings);
        // Apply some settings on-the-fly.
        if (newSettings.homeassistant) {
            await this.enableDisableExtension(settings.get().homeassistant.enabled, "HomeAssistant");
        }
        if (newSettings.advanced?.log_level != null) {
            logger_1.default.setLevel(settings.get().advanced.log_level);
        }
        if (newSettings.advanced?.log_namespaced_levels != null) {
            logger_1.default.setNamespacedLevels(settings.get().advanced.log_namespaced_levels);
        }
        if (newSettings.advanced?.log_debug_namespace_ignore != null) {
            logger_1.default.setDebugNamespaceIgnore(settings.get().advanced.log_debug_namespace_ignore);
        }
        logger_1.default.info("Successfully changed options");
        await this.publishInfo();
        return utils_1.default.getResponse(message, { restart_required: this.restartRequired });
    }
    async deviceRemove(message) {
        return await this.removeEntity("device", message);
    }
    async groupRemove(message) {
        return await this.removeEntity("group", message);
    }
    // biome-ignore lint/suspicious/useAwait: API
    async healthCheck(message) {
        return utils_1.default.getResponse(message, { healthy: true });
    }
    async coordinatorCheck(message) {
        const result = await this.zigbee.coordinatorCheck();
        const missingRouters = result.missingRouters.map((d) => {
            return { ieee_address: d.ieeeAddr, friendly_name: d.name };
        });
        return utils_1.default.getResponse(message, { missing_routers: missingRouters });
    }
    async groupAdd(message) {
        if (typeof message === "object" && message.friendly_name === undefined) {
            throw new Error("Invalid payload");
        }
        const friendlyName = typeof message === "object" ? message.friendly_name : message;
        const ID = typeof message === "object" && message.id !== undefined ? message.id : null;
        const group = settings.addGroup(friendlyName, ID);
        this.zigbee.createGroup(group.ID);
        await this.publishGroups();
        return utils_1.default.getResponse(message, { friendly_name: group.friendly_name, id: group.ID });
    }
    async deviceRename(message) {
        return await this.renameEntity("device", message);
    }
    async groupRename(message) {
        return await this.renameEntity("group", message);
    }
    // biome-ignore lint/suspicious/useAwait: API
    async restart(message) {
        // Wait 500 ms before restarting so response can be send.
        setTimeout(this.restartCallback, 500);
        logger_1.default.info("Restarting Zigbee2MQTT");
        return utils_1.default.getResponse(message, {});
    }
    async backup(message) {
        await this.zigbee.backup();
        const dataPath = data_1.default.getPath();
        const files = utils_1.default
            .getAllFiles(dataPath)
            .map((f) => [f, f.substring(dataPath.length + 1)])
            .filter((f) => !f[1].startsWith("log"));
        const zip = new jszip_1.default();
        for (const f of files) {
            zip.file(f[1], node_fs_1.default.readFileSync(f[0]));
        }
        const base64Zip = await zip.generateAsync({ type: "base64" });
        return utils_1.default.getResponse(message, { zip: base64Zip });
    }
    async installCodeAdd(message) {
        if (typeof message === "object" && message.value === undefined) {
            throw new Error("Invalid payload");
        }
        const value = typeof message === "object" ? message.value : message;
        await this.zigbee.addInstallCode(value);
        logger_1.default.info("Successfully added new install code");
        return utils_1.default.getResponse(message, { value });
    }
    async permitJoin(message) {
        let time;
        let device;
        if (typeof message === "object") {
            if (message.time === undefined) {
                throw new Error("Invalid payload");
            }
            time = Number.parseInt(message.time, 10);
            if (message.device) {
                const resolved = this.zigbee.resolveEntity(message.device);
                if (resolved instanceof device_2.default) {
                    device = resolved;
                }
                else {
                    throw new Error(`Device '${message.device}' does not exist`);
                }
            }
        }
        else {
            time = Number.parseInt(message, 10);
        }
        await this.zigbee.permitJoin(time, device);
        const response = { time };
        if (device) {
            response.device = device.name;
        }
        return utils_1.default.getResponse(message, response);
    }
    async touchlinkIdentify(message) {
        if (typeof message !== "object" || message.ieee_address === undefined || message.channel === undefined) {
            throw new Error("Invalid payload");
        }
        logger_1.default.info(`Start Touchlink identify of '${message.ieee_address}' on channel ${message.channel}`);
        await this.zigbee.touchlinkIdentify(message.ieee_address, message.channel);
        return utils_1.default.getResponse(message, { ieee_address: message.ieee_address, channel: message.channel });
    }
    async touchlinkFactoryReset(message) {
        let result = false;
        let payload = {};
        if (typeof message === "object" && message.ieee_address !== undefined && message.channel !== undefined) {
            logger_1.default.info(`Start Touchlink factory reset of '${message.ieee_address}' on channel ${message.channel}`);
            result = await this.zigbee.touchlinkFactoryReset(message.ieee_address, message.channel);
            payload = {
                ieee_address: message.ieee_address,
                channel: message.channel,
            };
        }
        else {
            logger_1.default.info("Start Touchlink factory reset of first found device");
            result = await this.zigbee.touchlinkFactoryResetFirst();
        }
        if (result) {
            logger_1.default.info("Successfully factory reset device through Touchlink");
            return utils_1.default.getResponse(message, payload);
        }
        logger_1.default.error("Failed to factory reset device through Touchlink");
        throw new Error("Failed to factory reset device through Touchlink");
    }
    async touchlinkScan(message) {
        logger_1.default.info("Start Touchlink scan");
        const result = await this.zigbee.touchlinkScan();
        const found = result.map((r) => {
            return { ieee_address: r.ieeeAddr, channel: r.channel };
        });
        logger_1.default.info("Finished Touchlink scan");
        return utils_1.default.getResponse(message, { found });
    }
    /**
     * Utils
     */
    async changeEntityOptions(entityType, message) {
        if (typeof message !== "object" || message.id === undefined || message.options === undefined) {
            throw new Error("Invalid payload");
        }
        const cleanup = (o) => {
            delete o.friendlyName;
            delete o.friendly_name;
            delete o.ID;
            delete o.type;
            delete o.devices;
            return o;
        };
        const ID = message.id;
        const entity = this.getEntity(entityType, ID);
        const oldOptions = (0, object_assign_deep_1.default)({}, cleanup(entity.options));
        if (message.options.icon) {
            const base64Match = utils_1.default.matchBase64File(message.options.icon);
            if (base64Match) {
                const fileSettings = utils_1.default.saveBase64DeviceIcon(base64Match);
                message.options.icon = fileSettings;
                logger_1.default.debug(`Saved base64 image as file to '${fileSettings}'`);
            }
        }
        const restartRequired = settings.changeEntityOptions(ID, message.options);
        if (restartRequired)
            this.restartRequired = true;
        const newOptions = cleanup(entity.options);
        await this.publishInfo();
        logger_1.default.info(`Changed config for ${entityType} ${ID}`);
        this.eventBus.emitEntityOptionsChanged({ from: oldOptions, to: newOptions, entity });
        return utils_1.default.getResponse(message, { from: oldOptions, to: newOptions, id: ID, restart_required: this.restartRequired });
    }
    async deviceConfigureReporting(message) {
        if (typeof message !== "object" ||
            message.id === undefined ||
            message.endpoint === undefined ||
            message.cluster === undefined ||
            message.maximum_report_interval === undefined ||
            message.minimum_report_interval === undefined ||
            message.reportable_change === undefined ||
            message.attribute === undefined) {
            throw new Error("Invalid payload");
        }
        const device = this.getEntity("device", message.id);
        const endpoint = device.endpoint(message.endpoint);
        if (!endpoint) {
            throw new Error(`Device '${device.ID}' does not have endpoint '${message.endpoint}'`);
        }
        const coordinatorEndpoint = this.zigbee.firstCoordinatorEndpoint();
        await endpoint.bind(message.cluster, coordinatorEndpoint);
        await endpoint.configureReporting(message.cluster, [
            {
                attribute: message.attribute,
                minimumReportInterval: message.minimum_report_interval,
                maximumReportInterval: message.maximum_report_interval,
                reportableChange: message.reportable_change,
            },
        ], message.options);
        await this.publishDevices();
        logger_1.default.info(`Configured reporting for '${message.id}', '${message.cluster}.${message.attribute}'`);
        return utils_1.default.getResponse(message, {
            id: message.id,
            endpoint: message.endpoint,
            cluster: message.cluster,
            maximum_report_interval: message.maximum_report_interval,
            minimum_report_interval: message.minimum_report_interval,
            reportable_change: message.reportable_change,
            attribute: message.attribute,
        });
    }
    async deviceInterview(message) {
        if (typeof message !== "object" || message.id === undefined) {
            throw new Error("Invalid payload");
        }
        const device = this.getEntity("device", message.id);
        logger_1.default.info(`Interviewing '${device.name}'`);
        try {
            await device.zh.interview(true);
            logger_1.default.info(`Successfully interviewed '${device.name}'`);
        }
        catch (error) {
            throw new Error(`interview of '${device.name}' (${device.ieeeAddr}) failed: ${error}`, { cause: error });
        }
        // A re-interview can for example result in a different modelId, therefore reconsider the definition.
        await device.resolveDefinition(true);
        this.eventBus.emitDevicesChanged();
        this.eventBus.emitExposesChanged({ device });
        return utils_1.default.getResponse(message, { id: message.id });
    }
    async deviceGenerateExternalDefinition(message) {
        if (typeof message !== "object" || message.id === undefined) {
            throw new Error("Invalid payload");
        }
        const device = this.getEntity("device", message.id);
        const source = await zhc.generateExternalDefinitionSource(device.zh);
        return utils_1.default.getResponse(message, { id: message.id, source });
    }
    async renameEntity(entityType, message) {
        const deviceAndHasLast = entityType === "device" && typeof message === "object" && message.last === true;
        if (typeof message !== "object" || (message.from === undefined && !deviceAndHasLast) || message.to === undefined) {
            throw new Error("Invalid payload");
        }
        if (deviceAndHasLast && !this.lastJoinedDeviceIeeeAddr) {
            throw new Error("No device has joined since start");
        }
        const from = deviceAndHasLast ? this.lastJoinedDeviceIeeeAddr : message.from;
        (0, utils_1.assertString)(message.to, "to");
        const to = message.to.trim();
        const homeAssisantRename = message.homeassistant_rename !== undefined ? message.homeassistant_rename : false;
        const entity = this.getEntity(entityType, from);
        const oldFriendlyName = entity.options.friendly_name;
        settings.changeFriendlyName(from, to);
        // Clear retained messages
        await this.mqtt.publish(oldFriendlyName, "", { clientOptions: { retain: true } });
        this.eventBus.emitEntityRenamed({ entity: entity, homeAssisantRename, from: oldFriendlyName, to });
        if (entity instanceof device_2.default) {
            await this.publishDevices();
        }
        else {
            await this.publishGroups();
            await this.publishInfo();
        }
        // Republish entity state
        await this.publishEntityState(entity, {});
        return utils_1.default.getResponse(message, { from: oldFriendlyName, to, homeassistant_rename: homeAssisantRename });
    }
    async removeEntity(entityType, message) {
        const ID = typeof message === "object" ? message.id : message.trim();
        const entity = this.getEntity(entityType, ID);
        // note: entity.name is dynamically retrieved, will change once device is removed (friendly => ieee)
        const friendlyName = entity.name;
        let block = false;
        let force = false;
        let blockForceLog = "";
        if (entityType === "device" && typeof message === "object") {
            block = !!message.block;
            force = !!message.force;
            blockForceLog = ` (block: ${block}, force: ${force})`;
        }
        else if (entityType === "group" && typeof message === "object") {
            force = !!message.force;
            blockForceLog = ` (force: ${force})`;
        }
        try {
            logger_1.default.info(`Removing ${entityType} '${friendlyName}'${blockForceLog}`);
            if (entity instanceof device_2.default) {
                if (block) {
                    settings.blockDevice(entity.ieeeAddr);
                }
                if (force) {
                    entity.zh.removeFromDatabase();
                }
                else {
                    await entity.zh.removeFromNetwork();
                }
                this.eventBus.emitEntityRemoved({ id: entity.ID, name: friendlyName, type: "device" });
                settings.removeDevice(entity.ID);
            }
            else {
                if (force) {
                    entity.zh.removeFromDatabase();
                }
                else {
                    await entity.zh.removeFromNetwork();
                }
                this.eventBus.emitEntityRemoved({ id: entity.ID, name: friendlyName, type: "group" });
                settings.removeGroup(entity.ID);
            }
            // Remove from state
            this.state.remove(entity.ID);
            // Clear any retained messages
            await this.mqtt.publish(friendlyName, "", { clientOptions: { retain: true } });
            logger_1.default.info(`Successfully removed ${entityType} '${friendlyName}'${blockForceLog}`);
            if (entity instanceof device_2.default) {
                await this.publishGroups();
                await this.publishDevices();
                // Refresh Cluster definition
                await this.publishDefinitions();
                const responseData = { id: ID, block, force };
                return utils_1.default.getResponse(message, responseData);
            }
            await this.publishGroups();
            const responseData = { id: ID, force };
            return utils_1.default.getResponse(message, 
            // @ts-expect-error typing infer does not work here
            responseData);
        }
        catch (error) {
            throw new Error(`Failed to remove ${entityType} '${friendlyName}'${blockForceLog} (${error})`);
        }
    }
    getEntity(type, id) {
        const entity = this.zigbee.resolveEntity(id);
        if (!entity || entity.constructor.name.toLowerCase() !== type) {
            throw new Error(`${utils_1.default.capitalize(type)} '${id}' does not exist`);
        }
        return entity;
    }
    async publishInfo() {
        const config = (0, object_assign_deep_1.default)({}, settings.get());
        // @ts-expect-error hidden from publish
        delete config.advanced.network_key;
        delete config.mqtt.password;
        delete config.frontend.auth_token;
        const networkParams = await this.zigbee.getNetworkParameters();
        const payload = {
            os: this.#osInfo,
            mqtt: this.mqtt.info,
            version: this.zigbee2mqttVersion.version,
            commit: this.zigbee2mqttVersion.commitHash,
            zigbee_herdsman_converters: this.zigbeeHerdsmanConvertersVersion,
            zigbee_herdsman: this.zigbeeHerdsmanVersion,
            coordinator: {
                ieee_address: this.zigbee.firstCoordinatorEndpoint().deviceIeeeAddress,
                ...this.coordinatorVersion,
            },
            network: {
                pan_id: networkParams.panID,
                extended_pan_id: networkParams.extendedPanID,
                channel: networkParams.channel,
            },
            log_level: logger_1.default.getLevel(),
            permit_join: this.zigbee.getPermitJoin(),
            permit_join_end: this.zigbee.getPermitJoinEnd(),
            restart_required: this.restartRequired,
            config,
            config_schema: settings.schemaJson,
        };
        await this.mqtt.publish("bridge/info", (0, json_stable_stringify_without_jsonify_1.default)(payload), { clientOptions: { retain: true }, skipLog: true });
    }
    async publishDevices() {
        const devices = [];
        for (const device of this.zigbee.devicesIterator()) {
            const endpoints = {};
            for (const endpoint of device.zh.endpoints) {
                const data = {
                    scenes: utils_1.default.getScenes(endpoint),
                    bindings: [],
                    configured_reportings: [],
                    clusters: {
                        input: endpoint.getInputClusters().map((c) => c.name),
                        output: endpoint.getOutputClusters().map((c) => c.name),
                    },
                };
                for (const bind of endpoint.binds) {
                    const target = utils_1.default.isZHEndpoint(bind.target)
                        ? { type: "endpoint", ieee_address: bind.target.deviceIeeeAddress, endpoint: bind.target.ID }
                        : { type: "group", id: bind.target.groupID };
                    data.bindings.push({ cluster: bind.cluster.name, target });
                }
                for (const configuredReporting of endpoint.configuredReportings) {
                    data.configured_reportings.push({
                        cluster: configuredReporting.cluster.name,
                        attribute: configuredReporting.attribute.name || configuredReporting.attribute.ID,
                        minimum_report_interval: configuredReporting.minimumReportInterval,
                        maximum_report_interval: configuredReporting.maximumReportInterval,
                        reportable_change: configuredReporting.reportableChange,
                    });
                }
                endpoints[endpoint.ID] = data;
            }
            devices.push({
                ieee_address: device.ieeeAddr,
                type: device.zh.type,
                network_address: device.zh.networkAddress,
                supported: device.isSupported,
                friendly_name: device.name,
                disabled: !!device.options.disabled,
                description: device.options.description,
                definition: this.getDefinitionPayload(device),
                power_source: device.zh.powerSource,
                software_build_id: device.zh.softwareBuildID,
                date_code: device.zh.dateCode,
                model_id: device.zh.modelID,
                /** @deprecated interviewing and interview_completed are superceded by interview_state */
                interviewing: device.zh.interviewState === device_1.InterviewState.InProgress,
                interview_completed: device.zh.interviewState === device_1.InterviewState.Successful,
                interview_state: device.zh.interviewState,
                manufacturer: device.zh.manufacturerName,
                endpoints,
            });
        }
        await this.mqtt.publish("bridge/devices", (0, json_stable_stringify_without_jsonify_1.default)(devices), { clientOptions: { retain: true }, skipLog: true });
    }
    async publishGroups() {
        const groups = [];
        for (const group of this.zigbee.groupsIterator()) {
            const members = [];
            for (const member of group.zh.members) {
                members.push({ ieee_address: member.deviceIeeeAddress, endpoint: member.ID });
            }
            groups.push({
                id: group.ID,
                friendly_name: group.ID === 901 ? "default_bind_group" : group.name,
                description: group.options.description,
                scenes: utils_1.default.getScenes(group.zh),
                members,
            });
        }
        await this.mqtt.publish("bridge/groups", (0, json_stable_stringify_without_jsonify_1.default)(groups), { clientOptions: { retain: true }, skipLog: true });
    }
    async publishDefinitions() {
        const data = {
            clusters: zigbee_herdsman_1.Zcl.Clusters,
            custom_clusters: {},
        };
        for (const device of this.zigbee.devicesIterator((d) => !utils_1.default.objectIsEmpty(d.customClusters))) {
            data.custom_clusters[device.ieeeAddr] = device.customClusters;
        }
        await this.mqtt.publish("bridge/definitions", (0, json_stable_stringify_without_jsonify_1.default)(data), { clientOptions: { retain: true }, skipLog: true });
    }
    getDefinitionPayload(device) {
        if (!device.definition) {
            return undefined;
        }
        // TODO: better typing to avoid @ts-expect-error
        // @ts-expect-error icon is valid for external definitions
        const definitionIcon = device.definition.icon;
        let icon = device.options.icon ?? definitionIcon;
        if (icon) {
            /* v8 ignore next */
            icon = icon.replace("$zigbeeModel", utils_1.default.sanitizeImageParameter(device.zh.modelID ?? ""));
            icon = icon.replace("$model", utils_1.default.sanitizeImageParameter(device.definition.model));
        }
        const payload = {
            model: device.definition.model,
            vendor: device.definition.vendor,
            description: device.definition.description,
            exposes: device.exposes(),
            supports_ota: !!device.definition.ota,
            options: device.definition.options ?? [],
            icon,
        };
        return payload;
    }
}
exports.default = Bridge;
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "onMQTTMessage", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceOptions", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupOptions", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "bridgeOptions", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceRemove", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupRemove", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "healthCheck", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "coordinatorCheck", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupAdd", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceRename", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupRename", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "restart", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "backup", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "installCodeAdd", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "permitJoin", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "touchlinkIdentify", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "touchlinkFactoryReset", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "touchlinkScan", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceConfigureReporting", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceInterview", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceGenerateExternalDefinition", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJpZGdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9icmlkZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxzREFBeUI7QUFDekIsb0VBQWtDO0FBQ2xDLGtIQUE4RDtBQUM5RCxrREFBMEI7QUFDMUIsNEVBQWtEO0FBRWxELDBFQUEwQztBQUMxQyxxREFBb0M7QUFDcEMseUVBQTRFO0FBQzVFLGdFQUFrRDtBQUNsRCw2REFBcUM7QUFHckMsd0RBQWdDO0FBQ2hDLDREQUFvQztBQUNwQywyREFBNkM7QUFDN0MsdURBQWtEO0FBQ2xELDREQUFvQztBQUVwQyxNQUFNLGFBQWEsR0FBRyxJQUFJLE1BQU0sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxzQkFBc0IsQ0FBQyxDQUFDO0FBRTFGLE1BQXFCLE1BQU8sU0FBUSxtQkFBUztJQUN6QyxpQkFBaUI7SUFDakIsT0FBTyxDQUF1QztJQUN0QyxrQkFBa0IsQ0FBMEM7SUFDNUQscUJBQXFCLENBQXFCO0lBQzFDLCtCQUErQixDQUFxQjtJQUNwRCxrQkFBa0IsQ0FBeUI7SUFDM0MsZUFBZSxHQUFHLEtBQUssQ0FBQztJQUN4Qix3QkFBd0IsQ0FBVTtJQUNsQyx3QkFBd0IsQ0FBVTtJQUNsQyxZQUFZLENBQXFCO0lBQ2pDLGFBQWEsR0FBZ0g7UUFDakksZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGFBQWE7UUFDcEMsNEJBQTRCLEVBQUUsSUFBSSxDQUFDLHdCQUF3QjtRQUMzRCxlQUFlLEVBQUUsSUFBSSxDQUFDLFlBQVk7UUFDbEMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLGVBQWU7UUFDeEMscUNBQXFDLEVBQUUsSUFBSSxDQUFDLGdDQUFnQztRQUM1RSxlQUFlLEVBQUUsSUFBSSxDQUFDLFlBQVk7UUFDbEMsV0FBVyxFQUFFLElBQUks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