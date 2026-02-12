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
exports.Controller = void 0;
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const zigbee_herdsman_1 = require("zigbee-herdsman");
const zigbee_herdsman_converters_1 = require("zigbee-herdsman-converters");
const eventBus_1 = __importDefault(require("./eventBus"));
// Extensions
const availability_1 = __importDefault(require("./extension/availability"));
const bind_1 = __importDefault(require("./extension/bind"));
const bridge_1 = __importDefault(require("./extension/bridge"));
const configure_1 = __importDefault(require("./extension/configure"));
const externalConverters_1 = __importDefault(require("./extension/externalConverters"));
const externalExtensions_1 = __importDefault(require("./extension/externalExtensions"));
const groups_1 = __importDefault(require("./extension/groups"));
const health_1 = __importDefault(require("./extension/health"));
const networkMap_1 = __importDefault(require("./extension/networkMap"));
const onEvent_1 = __importDefault(require("./extension/onEvent"));
const otaUpdate_1 = __importDefault(require("./extension/otaUpdate"));
const publish_1 = __importDefault(require("./extension/publish"));
const receive_1 = __importDefault(require("./extension/receive"));
const mqtt_1 = __importDefault(require("./mqtt"));
const state_1 = __importDefault(require("./state"));
const logger_1 = __importDefault(require("./util/logger"));
const sd_notify_1 = require("./util/sd-notify");
const settings = __importStar(require("./util/settings"));
const utils_1 = __importDefault(require("./util/utils"));
const zigbee_1 = __importDefault(require("./zigbee"));
const frontend_1 = require("./extension/frontend");
const homeassistant_1 = require("./extension/homeassistant");

class Controller {
    eventBus;
    zigbee;
    state;
    mqtt;
    restartCallback;
    exitCallback;
    extensions;
    extensionArgs;
    sdNotify;
    constructor(restartCallback, exitCallback) {
        logger_1.default.init();
        (0, zigbee_herdsman_1.setLogger)(logger_1.default);
        (0, zigbee_herdsman_converters_1.setLogger)(logger_1.default);
        this.eventBus = new eventBus_1.default();
        this.zigbee = new zigbee_1.default(this.eventBus);
        this.mqtt = new mqtt_1.default(this.eventBus);
        this.state = new state_1.default(this.eventBus, this.zigbee);
        this.restartCallback = restartCallback;
        this.exitCallback = exitCallback;
        // Initialize extensions.
        this.extensionArgs = [
            this.zigbee,
            this.mqtt,
            this.state,
            this.publishEntityState,
            this.eventBus,
            this.enableDisableExtension,
            this.restartCallback,
            this.addExtension,
        ];
        this.extensions = new Set([
            new externalConverters_1.default(...this.extensionArgs),
            new onEvent_1.default(...this.extensionArgs),
            new bridge_1.default(...this.extensionArgs),
            new publish_1.default(...this.extensionArgs),
            new receive_1.default(...this.extensionArgs),
            new configure_1.default(...this.extensionArgs),
            new networkMap_1.default(...this.extensionArgs),
            new groups_1.default(...this.extensionArgs),
            new bind_1.default(...this.extensionArgs),
            new otaUpdate_1.default(...this.extensionArgs),
            new externalExtensions_1.default(...this.extensionArgs),
            new availability_1.default(...this.extensionArgs),
            new health_1.default(...this.extensionArgs),
        ]);
    }
    async start() {
        if (settings.get().frontend.enabled) {
            const { Frontend } = frontend_1;
            this.extensions.add(new Frontend(...this.extensionArgs));
        }
        if (settings.get().homeassistant.enabled) {
            const { HomeAssistant } = homeassistant_1;
            this.extensions.add(new HomeAssistant(...this.extensionArgs));
        }
        this.state.start();
        const info = await utils_1.default.getZigbee2MQTTVersion();
        logger_1.default.info(`Starting Zigbee2MQTT version ${info.version} (commit #${info.commitHash})`);
        // Start zigbee
        try {
            await this.zigbee.start();
            this.eventBus.onAdapterDisconnected(this, this.onZigbeeAdapterDisconnected);
        }
        catch (error) {
            logger_1.default.error("Failed to start zigbee-herdsman");
            logger_1.default.error("Check https://www.zigbee2mqtt.io/guide/installation/20_zigbee2mqtt-fails-to-start_crashes-runtime.html for possible solutions");
            logger_1.default.error("Exiting...");
            // biome-ignore lint/style/noNonNullAssertion: always Error
            logger_1.default.error(error.stack);
            /* v8 ignore start */
            if (error.message.includes("USB adapter discovery error (No valid USB adapter found)")) {
                logger_1.default.error("If this happens after updating to Zigbee2MQTT 2.0.0, see https://github.com/Koenkk/zigbee2mqtt/discussions/24364");
            }
            /* v8 ignore stop */
            return await this.exit(1);
        }
        // Log zigbee clients on startup
        let deviceCount = 0;
        for (const device of this.zigbee.devicesIterator(utils_1.default.deviceNotCoordinator)) {
            // `definition` validated by `isSupported`
            const model = device.isSupported
                ? // biome-ignore lint/style/noNonNullAssertion: valid from `isSupported`
                    `${device.definition.model} - ${device.definition.vendor} ${device.definition.description}`
                : "Not supported";
            logger_1.default.info(`${device.name} (${device.ieeeAddr}): ${model} (${device.zh.type})`);
            deviceCount++;
        }
        logger_1.default.info(`Currently ${deviceCount} devices are joined.`);
        // MQTT
        try {
            await this.mqtt.connect();
        }
        catch (error) {
            logger_1.default.error(`MQTT failed to connect, exiting... (${error.message})`);
            await this.zigbee.stop();
            return await this.exit(1);
        }
        // copy current Set of extensions to ignore possible external extensions added while looping
        for (const extension of new Set(this.extensions)) {
            await this.startExtension(extension);
        }
        // Send all cached states.
        if (settings.get().advanced.cache_state_send_on_startup && settings.get().advanced.cache_state) {
            for (const entity of this.zigbee.devicesAndGroupsIterator()) {
                if (this.state.exists(entity)) {
                    await this.publishEntityState(entity, this.state.get(entity), "publishCached");
                }
            }
        }
        this.eventBus.onLastSeenChanged(this, (data) => utils_1.default.publishLastSeen(data, settings.get(), false, this.publishEntityState));
        logger_1.default.info("Zigbee2MQTT started!");
        this.sdNotify = await (0, sd_notify_1.initSdNotify)();
        settings.setOnboarding(false);
    }
    async enableDisableExtension(enable, name) {
        if (enable) {
            switch (name) {
                case "Frontend": {
                    if (!settings.get().frontend.enabled) {
                        throw new Error("Tried to enable Frontend extension disabled in settings");
                    }
                    // this is not actually used, not tested either
                    /* v8 ignore start */
                    const { Frontend } = frontend_1;
                    await this.addExtension(new Frontend(...this.extensionArgs));
                    break;
                    /* v8 ignore stop */
                }
                case "HomeAssistant": {
                    if (!settings.get().homeassistant.enabled) {
                        throw new Error("Tried to enable HomeAssistant extension disabled in settings");
                    }
                    const { HomeAssistant } = homeassistant_1;
                    await this.addExtension(new HomeAssistant(...this.extensionArgs));
                    break;
                }
                default: {
                    throw new Error(`Extension ${name} does not exist (should be added with 'addExtension') or is built-in that cannot be enabled at runtime`);
                }
            }
        }
        else {
            switch (name) {
                case "Frontend": {
                    if (settings.get().frontend.enabled) {
                        throw new Error("Tried to disable Frontend extension enabled in settings");
                    }
                    break;
                }
                case "HomeAssistant": {
                    if (settings.get().homeassistant.enabled) {
                        throw new Error("Tried to disable HomeAssistant extension enabled in settings");
                    }
                    break;
                }
                case "Availability":
                case "Bind":
                case "Bridge":
                case "Configure":
                case "ExternalConverters":
                case "ExternalExtensions":
                case "Groups":
                case "NetworkMap":
                case "OnEvent":
                case "OTAUpdate":
                case "Publish":
                case "Receive": {
                    throw new Error(`Built-in extension ${name} cannot be disabled at runtime`);
                }
            }
            const extension = this.getExtension(name);
            if (extension) {
                await this.removeExtension(extension);
            }
        }
    }
    getExtension(name) {
        for (const extension of this.extensions) {
            if (extension.constructor.name === name) {
                return extension;
            }
        }
    }
    async addExtension(extension) {
        for (const ext of this.extensions) {
            if (ext.constructor.name === extension.constructor.name) {
                throw new Error(`Extension with name ${ext.constructor.name} already present`);
            }
        }
        this.extensions.add(extension);
        await this.startExtension(extension);
    }
    async removeExtension(extension) {
        if (this.extensions.delete(extension)) {
            await this.stopExtension(extension);
        }
    }
    async startExtension(extension) {
        try {
            await extension.start();
        }
        catch (error) {
            logger_1.default.error(`Failed to start '${extension.constructor.name}' (${error.stack})`);
        }
    }
    async stopExtension(extension) {
        try {
            await extension.stop();
        }
        catch (error) {
            logger_1.default.error(`Failed to stop '${extension.constructor.name}' (${error.stack})`);
        }
    }
    async stop(restart = false) {
        this.sdNotify?.notifyStopping();
        let code = 0;
        for (const extension of this.extensions) {
            try {
                await extension.stop();
            }
            catch (error) {
                logger_1.default.error(`Failed to stop '${extension.constructor.name}' (${error.stack})`);
                code = 1;
            }
        }
        this.eventBus.removeListeners(this);
        // Wrap-up
        this.state.stop();
        await this.mqtt.disconnect();
        try {
            await this.zigbee.stop();
            logger_1.default.info("Stopped Zigbee2MQTT");
        }
        catch (error) {
            logger_1.default.error(`Failed to stop Zigbee2MQTT (${error.stack})`);
            code = 1;
        }
        this.sdNotify?.stop();
        return await this.exit(code, restart);
    }
    async exit(code, restart = false) {
        await logger_1.default.end();
        return await this.exitCallback(code, restart);
    }
    async onZigbeeAdapterDisconnected() {
        logger_1.default.error("Adapter disconnected, stopping");
        await this.stop();
    }
    async publishEntityState(entity, payload, stateChangeReason) {
        let message = { ...payload };
        // Update state cache with new state.
        const newState = this.state.set(entity, payload, stateChangeReason);
        if (settings.get().advanced.cache_state) {
            // Add cached state to payload
            message = newState;
        }
        const options = {
            clientOptions: {
                retain: utils_1.default.getObjectProperty(entity.options, "retain", false),
                qos: utils_1.default.getObjectProperty(entity.options, "qos", 0),
            },
            meta: {
                isEntityState: true,
            },
        };
        const retention = utils_1.default.getObjectProperty(entity.options, "retention", false);
        if (retention !== false) {
            options.clientOptions.properties = { messageExpiryInterval: retention };
        }
        if (entity.isDevice() && settings.get().mqtt.include_device_information) {
            message.device = {
                friendlyName: entity.name,
                model: entity.definition?.model,
                ieeeAddr: entity.ieeeAddr,
                networkAddress: entity.zh.networkAddress,
                type: entity.zh.type,
                manufacturerID: entity.zh.manufacturerID,
                powerSource: entity.zh.powerSource,
                applicationVersion: entity.zh.applicationVersion,
                stackVersion: entity.zh.stackVersion,
                zclVersion: entity.zh.zclVersion,
                hardwareVersion: entity.zh.hardwareVersion,
                dateCode: entity.zh.dateCode,
                softwareBuildID: entity.zh.softwareBuildID,
                // Manufacturer name can contain \u0000, remove this.
                // https://github.com/home-assistant/core/issues/85691
                /* v8 ignore next */
                manufacturerName: entity.zh.manufacturerName?.split("\u0000")[0],
            };
        }
        // Add lastseen
        const lastSeen = settings.get().advanced.last_seen;
        if (entity.isDevice() && lastSeen !== "disable" && entity.zh.lastSeen) {
            message.last_seen = utils_1.default.formatDate(entity.zh.lastSeen, lastSeen);
        }
        // Add device linkquality.
        if (entity.isDevice() && entity.zh.linkquality !== undefined) {
            message.linkquality = entity.zh.linkquality;
        }
        for (const extension of this.extensions) {
            extension.adjustMessageBeforePublish?.(entity, message);
        }
        // Filter mqtt message attributes
        utils_1.default.filterProperties(entity.options.filtered_attributes, message);
        if (!utils_1.default.objectIsEmpty(message)) {
            const output = settings.get().advanced.output;
            if (output === "attribute_and_json" || output === "json") {
                await this.mqtt.publish(entity.name, (0, json_stable_stringify_without_jsonify_1.default)(message), options);
            }
            if (output === "attribute_and_json" || output === "attribute") {
                await this.iteratePayloadAttributeOutput(`${entity.name}/`, message, options);
            }
        }
        this.eventBus.emitPublishEntityState({ entity, message, stateChangeReason, payload });
    }
    async iteratePayloadAttributeOutput(topicRoot, payload, options) {
        for (const [key, value] of Object.entries(payload)) {
            let subPayload = value;
            let message = null;
            // Special cases
            if (key === "color" && utils_1.default.objectHasProperties(subPayload, ["r", "g", "b"])) {
                subPayload = [subPayload.r, subPayload.g, subPayload.b];
            }
            // Check Array first, since it is also an Object
            if (subPayload === null || subPayload === undefined) {
                message = "";
            }
            else if (Array.isArray(subPayload)) {
                message = subPayload.map((x) => `${x}`).join(",");
            }
            else if (typeof subPayload === "object") {
                await this.iteratePayloadAttributeOutput(`${topicRoot}${key}-`, subPayload, options);
            }
            else {
                message = typeof subPayload === "string" ? subPayload : (0, json_stable_stringify_without_jsonify_1.default)(subPayload);
            }
            if (message !== null) {
                await this.mqtt.publish(`${topicRoot}${key}`, message, options);
            }
        }
    }
}
exports.Controller = Controller;
__decorate([
    bind_decorator_1.default
], Controller.prototype, "enableDisableExtension", null);
__decorate([
    bind_decorator_1.default
], Controller.prototype, "addExtension", null);
__decorate([
    bind_decorator_1.default
], Controller.prototype, "onZigbeeAdapterDisconnected", null);
__decorate([
    bind_decorator_1.default
], Controller.prototype, "publishEntityState", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udHJvbGxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi9jb250cm9sbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9FQUFrQztBQUNsQyxrSEFBOEQ7QUFDOUQscURBQXlEO0FBQ3pELDJFQUFxRTtBQUNyRSwwREFBa0M7QUFDbEMsYUFBYTtBQUNiLDRFQUE2RDtBQUM3RCw0REFBNkM7QUFDN0MsZ0VBQWlEO0FBQ2pELHNFQUF1RDtBQUV2RCx3RkFBeUU7QUFDekUsd0ZBQXlFO0FBQ3pFLGdFQUFpRDtBQUNqRCxnRUFBaUQ7QUFDakQsd0VBQXlEO0FBQ3pELGtFQUFtRDtBQUNuRCxzRUFBdUQ7QUFDdkQsa0VBQW1EO0FBQ25ELGtFQUFtRDtBQUNuRCxrREFBcUQ7QUFDckQsb0RBQTRCO0FBRTVCLDJEQUFtQztBQUNuQyxnREFBOEM7QUFDOUMsMERBQTRDO0FBQzVDLHlEQUFpQztBQUNqQyxzREFBOEI7QUFFOUIsTUFBYSxVQUFVO0lBQ1gsUUFBUSxDQUFXO0lBQ25CLE1BQU0sQ0FBUztJQUNmLEtBQUssQ0FBUTtJQUNiLElBQUksQ0FBTztJQUNYLGVBQWUsQ0FBc0I7SUFDckMsWUFBWSxDQUFvRDtJQUN4RCxVQUFVLENBQWlCO0lBQzNCLGFBQWEsQ0FBMEM7SUFDL0QsUUFBUSxDQUEyQztJQUUzRCxZQUFZLGVBQW9DLEVBQUUsWUFBK0Q7UUFDN0csZ0JBQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNkLElBQUEsMkJBQVcsRUFBQyxnQkFBTSxDQUFDLENBQUM7UUFDcEIsSUFBQSxzQ0FBWSxFQUFDLGdCQUFNLENBQUMsQ0FBQztRQUNyQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksa0JBQVEsRUFBRSxDQUFDO1FBQy9CLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxnQkFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztR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