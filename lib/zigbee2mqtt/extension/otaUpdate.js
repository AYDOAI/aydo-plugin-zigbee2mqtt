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
const node_path_1 = __importDefault(require("node:path"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const zigbee_herdsman_1 = require("zigbee-herdsman");
const zigbee_herdsman_converters_1 = require("zigbee-herdsman-converters");
const device_1 = __importDefault(require("../model/device"));
const data_1 = __importDefault(require("../util/data"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importDefault(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
const topicRegex = new RegExp(`^${settings.get().mqtt.base_topic}/bridge/request/device/ota_update/(update|check|schedule|unschedule)/?(downgrade)?`, "i");
class OTAUpdate extends extension_1.default {
    inProgress = new Set();
    lastChecked = new Map();
    scheduledUpgrades = new Set();
    scheduledDowngrades = new Set();
    // biome-ignore lint/suspicious/useAwait: API
    async start() {
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
        this.eventBus.onDeviceMessage(this, this.onZigbeeEvent);
        const otaSettings = settings.get().ota;
        // Let OTA module know if the override index file is provided
        let overrideIndexLocation = otaSettings.zigbee_ota_override_index_location;
        // If the file name is not a full path, then treat it as a relative to the data directory
        if (overrideIndexLocation && !zigbee_herdsman_converters_1.ota.isValidUrl(overrideIndexLocation) && !node_path_1.default.isAbsolute(overrideIndexLocation)) {
            overrideIndexLocation = data_1.default.joinPath(overrideIndexLocation);
        }
        // In order to support local firmware files we need to let zigbeeOTA know where the data directory is
        zigbee_herdsman_converters_1.ota.setConfiguration({
            dataDir: data_1.default.getPath(),
            overrideIndexLocation,
            // TODO: implement me
            imageBlockResponseDelay: otaSettings.image_block_response_delay,
            defaultMaximumDataSize: otaSettings.default_maximum_data_size,
        });
        // In case Zigbee2MQTT is restared during an update, progress and remaining values are still in state, remove them.
        for (const device of this.zigbee.devicesIterator(utils_1.default.deviceNotCoordinator)) {
            this.removeProgressAndRemainingFromState(device);
            // Reset update state, e.g. when Z2M restarted during update.
            if (this.state.get(device).update?.state === "updating") {
                this.state.get(device).update.state = "available";
            }
        }
    }
    removeProgressAndRemainingFromState(device) {
        const deviceState = this.state.get(device);
        if (deviceState.update) {
            delete deviceState.update.progress;
            delete deviceState.update.remaining;
        }
    }
    async onZigbeeEvent(data) {
        if (data.type !== "commandQueryNextImageRequest" || !data.device.definition || this.inProgress.has(data.device.ieeeAddr)) {
            return;
        }
        // `commandQueryNextImageRequest` check above should ensures this is valid but...
        (0, node_assert_1.default)(data.meta.zclTransactionSequenceNumber !== undefined, "Missing 'queryNextImageRequest' transaction sequence number (cannot match reply)");
        logger_1.default.debug(`Device '${data.device.name}' requested OTA`);
        if (data.device.definition.ota) {
            if (this.scheduledUpgrades.has(data.device.ieeeAddr) || this.scheduledDowngrades.has(data.device.ieeeAddr)) {
                this.inProgress.add(data.device.ieeeAddr);
                logger_1.default.info(`Updating '${data.device.name}' to latest firmware`);
                try {
                    const fileVersion = await zigbee_herdsman_converters_1.ota.update(data.device.zh, data.device.otaExtraMetas, this.scheduledDowngrades.has(data.device.ieeeAddr), async (progress, remaining) => {
                        let msg = `Update of '${data.device.name}' at ${progress.toFixed(2)}%`;
                        if (remaining) {
                            msg += `, ≈ ${Math.round(remaining / 60)} minutes remaining`;
                        }
                        logger_1.default.info(msg);
                        await this.publishEntityState(data.device, this.getEntityPublishPayload(data.device, "updating", progress, remaining ?? undefined));
                    }, data.data, data.meta.zclTransactionSequenceNumber);
                    // remove right away on update success or no image in case any of the below calls fail
                    this.scheduledUpgrades.delete(data.device.ieeeAddr);
                    this.scheduledDowngrades.delete(data.device.ieeeAddr);
                    if (fileVersion === undefined) {
                        logger_1.default.info(`No image currently available for '${data.device.name}'. Unscheduling.`);
                        // XXX: superfluous?
                        this.removeProgressAndRemainingFromState(data.device);
                        await this.publishEntityState(data.device, this.getEntityPublishPayload(data.device, "idle"));
                        this.inProgress.delete(data.device.ieeeAddr);
                        return;
                    }
                    logger_1.default.info(`Finished update of '${data.device.name}'`);
                    this.removeProgressAndRemainingFromState(data.device);
                    await this.publishEntityState(data.device, this.getEntityPublishPayload(data.device, { available: false, currentFileVersion: fileVersion, otaFileVersion: fileVersion }));
                    const firmwareTo = await this.readSoftwareBuildIDAndDateCode(data.device);
                    logger_1.default.info(() => `Device '${data.device.name}' was updated to '${(0, json_stable_stringify_without_jsonify_1.default)(firmwareTo)}'`);
                    /**
                     * Re-configure after reading software build ID and date code, some devices use a
                     * custom attribute for this (e.g. Develco SMSZB-120)
                     */
                    this.eventBus.emitReconfigure({ device: data.device });
                    this.eventBus.emitDevicesChanged();
                }
                catch (e) {
                    logger_1.default.debug(`Update of '${data.device.name}' failed (${e}). Retry scheduled for next request.`);
                    this.removeProgressAndRemainingFromState(data.device);
                    await this.publishEntityState(data.device, this.getEntityPublishPayload(data.device, "scheduled"));
                }
                this.inProgress.delete(data.device.ieeeAddr);
                return; // we're done
            }
            if (!settings.get().ota.disable_automatic_update_check) {
                // When a device does a next image request, it will usually do it a few times after each other
                // with only 10 - 60 seconds inbetween. It doesn't make sense to check for a new update
                // each time, so this interval can be set by the user. The default is 1,440 minutes (one day).
                const updateCheckInterval = settings.get().ota.update_check_interval * 1000 * 60;
                const deviceLastChecked = this.lastChecked.get(data.device.ieeeAddr);
                const check = deviceLastChecked !== undefined ? Date.now() - deviceLastChecked > updateCheckInterval : true;
                if (!check) {
                    return;
                }
                this.inProgress.add(data.device.ieeeAddr);
                this.lastChecked.set(data.device.ieeeAddr, Date.now());
                let availableResult;
                try {
                    // never use 'previous' when responding to device request
                    availableResult = await zigbee_herdsman_converters_1.ota.isUpdateAvailable(data.device.zh, data.device.otaExtraMetas, data.data, false);
                }
                catch (error) {
                    logger_1.default.debug(`Failed to check if update available for '${data.device.name}' (${error})`);
                }
                await this.publishEntityState(data.device, this.getEntityPublishPayload(data.device, availableResult ?? "idle"));
                if (availableResult?.available) {
                    const message = `Update available for '${data.device.name}'`;
                    logger_1.default.info(message);
                }
            }
        }
        // Respond to stop the client from requesting OTAs
        const endpoint = data.device.zh.endpoints.find((e) => e.supportsOutputCluster("genOta")) || data.endpoint;
        await endpoint.commandResponse("genOta", "queryNextImageResponse", { status: zigbee_herdsman_1.Zcl.Status.NO_IMAGE_AVAILABLE }, undefined, data.meta.zclTransactionSequenceNumber);
        logger_1.default.debug(`Responded to OTA request of '${data.device.name}' with 'NO_IMAGE_AVAILABLE'`);
        this.inProgress.delete(data.device.ieeeAddr);
    }
    async readSoftwareBuildIDAndDateCode(device, sendPolicy) {
        try {
            const endpoint = device.zh.endpoints.find((e) => e.supportsInputCluster("genBasic"));
            (0, node_assert_1.default)(endpoint);
            const result = await endpoint.read("genBasic", ["dateCode", "swBuildId"], { sendPolicy });
            return { softwareBuildID: result.swBuildId, dateCode: result.dateCode };
        }
        catch {
            return undefined;
        }
    }
    getEntityPublishPayload(device, state, progress, remaining) {
        const deviceUpdateState = this.state.get(device).update;
        const payload = {
            update: {
                state: typeof state === "string" ? state : state.available ? "available" : "idle",
                installed_version: typeof state === "string" ? deviceUpdateState?.installed_version : state.currentFileVersion,
                latest_version: typeof state === "string" ? deviceUpdateState?.latest_version : state.otaFileVersion,
            },
        };
        if (progress !== undefined) {
            payload.update.progress = progress;
        }
        if (remaining !== undefined) {
            payload.update.remaining = Math.round(remaining);
        }
        return payload;
    }
    async onMQTTMessage(data) {
        const topicMatch = data.topic.match(topicRegex);
        if (!topicMatch) {
            return;
        }
        const message = utils_1.default.parseJSON(data.message, data.message);
        const ID = (typeof message === "object" && message.id !== undefined ? message.id : message);
        const device = this.zigbee.resolveEntity(ID);
        const type = topicMatch[1];
        const downgrade = topicMatch[2] === "downgrade";
        let error;
        let errorStack;
        if (!(device instanceof device_1.default)) {
            error = `Device '${ID}' does not exist`;
        }
        else if (!device.definition || !device.definition.ota) {
            error = `Device '${device.name}' does not support OTA updates`;
        }
        else if (this.inProgress.has(device.ieeeAddr)) {
            // also guards against scheduling while check/update op in progress that could result in undesired OTA state
            error = `Update or check for update already in progress for '${device.name}'`;
        }
        else {
            switch (type) {
                case "check": {
                    this.inProgress.add(device.ieeeAddr);
                    logger_1.default.info(`Checking if update available for '${device.name}'`);
                    try {
                        const availableResult = await zigbee_herdsman_converters_1.ota.isUpdateAvailable(device.zh, device.otaExtraMetas, undefined, downgrade);
                        logger_1.default.info(`${availableResult.available ? "Update" : "No update"} available for '${device.name}'`);
                        await this.publishEntityState(device, this.getEntityPublishPayload(device, availableResult));
                        this.lastChecked.set(device.ieeeAddr, Date.now());
                        const response = utils_1.default.getResponse(message, {
                            id: ID,
                            update_available: availableResult.available,
                        });
                        await this.mqtt.publish("bridge/response/device/ota_update/check", (0, json_stable_stringify_without_jsonify_1.default)(response));
                    }
                    catch (e) {
                        error = `Failed to check if update available for '${device.name}' (${e.message})`;
                        errorStack = e.stack;
                    }
                    break;
                }
                case "update": {
                    this.inProgress.add(device.ieeeAddr);
                    if (this.scheduledUpgrades.delete(device.ieeeAddr)) {
                        logger_1.default.info(`Previously scheduled '${device.name}' upgrade was cancelled by manual update`);
                    }
                    else if (this.scheduledDowngrades.delete(device.ieeeAddr)) {
                        logger_1.default.info(`Previously scheduled '${device.name}' downgrade was cancelled by manual update`);
                    }
                    logger_1.default.info(`Updating '${device.name}' to ${downgrade ? "previous" : "latest"} firmware`);
                    try {
                        const firmwareFrom = await this.readSoftwareBuildIDAndDateCode(device, "immediate");
                        const fileVersion = await zigbee_herdsman_converters_1.ota.update(device.zh, device.otaExtraMetas, downgrade, async (progress, remaining) => {
                            let msg = `Update of '${device.name}' at ${progress.toFixed(2)}%`;
                            if (remaining) {
                                msg += `, ≈ ${Math.round(remaining / 60)} minutes remaining`;
                            }
                            logger_1.default.info(msg);
                            await this.publishEntityState(device, this.getEntityPublishPayload(device, "updating", progress, remaining ?? undefined));
                        });
                        if (fileVersion === undefined) {
                            throw new Error("No image currently available");
                        }
                        logger_1.default.info(`Finished update of '${device.name}'`);
                        this.removeProgressAndRemainingFromState(device);
                        await this.publishEntityState(device, this.getEntityPublishPayload(device, { available: false, currentFileVersion: fileVersion, otaFileVersion: fileVersion }));
                        const firmwareTo = await this.readSoftwareBuildIDAndDateCode(device);
                        logger_1.default.info(() => `Device '${device.name}' was updated from '${(0, json_stable_stringify_without_jsonify_1.default)(firmwareFrom)}' to '${(0, json_stable_stringify_without_jsonify_1.default)(firmwareTo)}'`);
                        /**
                         * Re-configure after reading software build ID and date code, some devices use a
                         * custom attribute for this (e.g. Develco SMSZB-120)
                         */
                        this.eventBus.emitReconfigure({ device });
                        this.eventBus.emitDevicesChanged();
                        const response = utils_1.default.getResponse(message, {
                            id: ID,
                            from: firmwareFrom ? { software_build_id: firmwareFrom.softwareBuildID, date_code: firmwareFrom.dateCode } : undefined,
                            to: firmwareTo ? { software_build_id: firmwareTo.softwareBuildID, date_code: firmwareTo.dateCode } : undefined,
                        });
                        await this.mqtt.publish("bridge/response/device/ota_update/update", (0, json_stable_stringify_without_jsonify_1.default)(response));
                    }
                    catch (e) {
                        logger_1.default.debug(`Update of '${device.name}' failed (${e})`);
                        error = `Update of '${device.name}' failed (${e.message})`;
                        errorStack = e.stack;
                        this.removeProgressAndRemainingFromState(device);
                        await this.publishEntityState(device, this.getEntityPublishPayload(device, "available"));
                    }
                    break;
                }
                case "schedule": {
                    // ensure only one type scheduled by deleting from the other if necessary
                    if (downgrade) {
                        if (this.scheduledUpgrades.delete(device.ieeeAddr)) {
                            logger_1.default.info(`Previously scheduled '${device.name}' upgrade was cancelled in favor of new downgrade request`);
                        }
                        this.scheduledDowngrades.add(device.ieeeAddr);
                    }
                    else {
                        if (this.scheduledDowngrades.delete(device.ieeeAddr)) {
                            logger_1.default.info(`Previously scheduled '${device.name}' downgrade was cancelled in favor of new upgrade request`);
                        }
                        this.scheduledUpgrades.add(device.ieeeAddr);
                    }
                    logger_1.default.info(`Scheduled '${device.name}' to ${downgrade ? "downgrade" : "upgrade"} firmware on next request from device`);
                    await this.publishEntityState(device, this.getEntityPublishPayload(device, "scheduled", undefined, undefined));
                    const response = utils_1.default.getResponse(message, {
                        id: ID,
                    });
                    await this.mqtt.publish("bridge/response/device/ota_update/schedule", (0, json_stable_stringify_without_jsonify_1.default)(response));
                    break;
                }
                case "unschedule": {
                    if (this.scheduledUpgrades.delete(device.ieeeAddr)) {
                        logger_1.default.info(`Previously scheduled '${device.name}' upgrade was cancelled`);
                    }
                    else if (this.scheduledDowngrades.delete(device.ieeeAddr)) {
                        logger_1.default.info(`Previously scheduled '${device.name}' downgrade was cancelled`);
                    }
                    await this.publishEntityState(device, this.getEntityPublishPayload(device, "idle", undefined, undefined));
                    const response = utils_1.default.getResponse(message, {
                        id: ID,
                    });
                    await this.mqtt.publish("bridge/response/device/ota_update/unschedule", (0, json_stable_stringify_without_jsonify_1.default)(response));
                    break;
                }
            }
            this.inProgress.delete(device.ieeeAddr);
        }
        if (error) {
            const response = utils_1.default.getResponse(message, {}, error);
            await this.mqtt.publish(`bridge/response/device/ota_update/${type}`, (0, json_stable_stringify_without_jsonify_1.default)(response));
            logger_1.default.error(error);
            if (errorStack) {
                logger_1.default.debug(errorStack);
            }
        }
    }
}
exports.default = OTAUpdate;
__decorate([
    bind_decorator_1.default
], OTAUpdate.prototype, "onZigbeeEvent", null);
__decorate([
    bind_decorator_1.default
], OTAUpdate.prototype, "onMQTTMessage", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3RhVXBkYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9vdGFVcGRhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw4REFBaUM7QUFDakMsMERBQTZCO0FBQzdCLG9FQUFrQztBQUNsQyxrSEFBOEQ7QUFDOUQscURBQW9DO0FBRXBDLDJFQUErQztBQUMvQyw2REFBcUM7QUFFckMsd0RBQW1DO0FBQ25DLDREQUFvQztBQUNwQywyREFBNkM7QUFDN0MsMERBQWtDO0FBQ2xDLDREQUFvQztBQWNwQyxNQUFNLFVBQVUsR0FBRyxJQUFJLE1BQU0sQ0FDekIsSUFBSSxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsb0ZBQW9GLEVBQ3RILEdBQUcsQ0FDTixDQUFDO0FBRUYsTUFBcUIsU0FBVSxTQUFRLG1CQUFTO0lBQ3BDLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBQy9CLFdBQVcsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztJQUN4QyxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBQ3RDLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFFaEQsNkNBQTZDO0lBQ3BDLEtBQUssQ0FBQyxLQUFLO1FBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDdEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUV4RCxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDO1FBQ3ZDLDZEQUE2RDtRQUM3RCxJQUFJLHFCQUFxQixHQUFHLFdBQVcsQ0FBQyxrQ0FBa0MsQ0FBQztRQUUzRSx5RkFBeUY7UUFDekYsSUFBSSxxQkFBcUIsSUFBSSxDQUFDLGdDQUFHLENBQUMsVUFBVSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxtQkFBSSxDQUFDLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQyxFQUFFLENBQUM7WUFDN0cscUJBQXFCLEdBQUcsY0FBTyxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7UUFFRCxxR0FBcUc7UUFDckcsZ0NBQUcsQ0FBQyxnQkFBZ0IsQ0FBQztZQUNqQixPQUFPLEVBQUUsY0FBTyxDQUFDLE9BQU8sRUFBRTtZQUMxQixxQkFBcUI7WUFDckIscUJBQXFCO1lBQ3JCLHVCQUF1QixFQUFFLFdBQVcsQ0FBQywwQkFBMEI7WUFDL0Qsc0JBQXNCLEVBQUUsV0FBVyxDQUFDLHlCQUF5QjtTQUNoRSxDQUFDLENBQUM7UUFFSCxtSEFBbUg7UUFDbkgsS0FBSyxNQUFNLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxlQUFLLENBQUMsb0JBQW9CLENBQUMsRUFBRSxDQUFDO1lBQzNFLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUVqRCw2REFBNkQ7WUFDN0QsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxLQUFLLFVBQVUsRUFBRSxDQUFDO2dCQUN0RCxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQztZQUN0RCxDQUFDO1FBQ0wsQ0FBQztJQUNMLENBQUM7SUFFTyxtQ0FBbUMsQ0FBQyxNQUFjO1FBQ3RELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTNDLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3JCLE9BQU8sV0FBVyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUM7WUFDbkMsT0FBTyxXQUFXLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQztRQUN4QyxDQUFDO0lBQ0wsQ0FBQztJQUVtQixBQUFOLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBNkI7UUFDM0QsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLDhCQUE4QixJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ3ZILE9BQU87UUFDWCxDQUFDO1FBRUQsaUZBQWlGO1FBQ2pGLElBQUEscUJBQU0sRUFDRixJQUFJLENBQUMsSUFBSSxDQUFDLDRCQUE0QixLQUFLLFNBQVMsRUFDcEQsa0ZBQWtGLENBQ3JGLENBQUM7UUFFRixnQkFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxDQUFDO1FBRTNELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDN0IsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQ3pHLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBRTFDLGdCQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLHNCQUFzQixDQUFDLENBQUM7Z0JBRWpFLElBQUksQ0FBQztvQkFDRCxNQUFNLFdBQVcsR0FBRyxNQUFNLGdDQUFHLENBQUMsTUFBTSxDQUNoQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFDZCxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsRUFDekIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUNsRCxLQUFLLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxFQUFFO3dCQUMxQixJQUFJLEdBQUcsR0FBRyxjQUFjLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxRQUFRLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQzt3QkFFdkUsSUFBSSxTQUFTLEVBQUUsQ0FBQzs0QkFDWixHQUFHLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUMsb0JBQW9CLENBQUM7d0JBQ2pFLENBQUM7d0JBRUQsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBRWpCLE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUN6QixJQUFJLENBQUMsTUFBTSxFQUNYLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsU0FBUyxJQUFJLFNBQVMsQ0FBQyxDQUMxRixDQUFDO29CQUNOLENBQUMsRUFDRCxJQUFJLENBQUMsSUFBcUIsRUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FDekMsQ0FBQztvQkFFRixzRkFBc0Y7b0JBQ3RGLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDcEQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUV0RCxJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUUsQ0FBQzt3QkFDNUIsZ0JBQU0sQ0FBQyxJQUFJLENBQUMscUNBQXFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxrQkFBa0IsQ0FBQyxDQUFDO3dCQUVyRixvQkFBb0I7d0JBQ3BCLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7d0JBQ3RELE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQzt3QkFDOUYsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQzt3QkFFN0MsT0FBTztvQkFDWCxDQUFDO29CQUVELGdCQUFNLENBQUMsSUFBSSxDQUFDLHVCQUF1QixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7b0JBRXhELElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3RELE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUN6QixJQUFJLENBQUMsTUFBTSxFQUNYLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBQyxDQUFDLENBQzlILENBQUM7b0JBRUYsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsOEJBQThCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUUxRSxnQkFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxXQUFXLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxxQkFBcUIsSUFBQSwrQ0FBUyxFQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFFNUY7Ozt1QkFHRztvQkFDSCxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxFQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFDLENBQUMsQ0FBQztvQkFDckQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUN2QyxDQUFDO2dCQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7b0JBQ1QsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsY0FBYyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksYUFBYSxDQUFDLHNDQUFzQyxDQUFDLENBQUM7b0JBRWpHLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQ3RELE1BQU0sSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztnQkFDdkcsQ0FBQztnQkFFRCxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUU3QyxPQUFPLENBQUMsYUFBYTtZQUN6QixDQUFDO1lBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsOEJBQThCLEVBQUUsQ0FBQztnQkFDckQsOEZBQThGO2dCQUM5Rix1RkFBdUY7Z0JBQ3ZGLDhGQUE4RjtnQkFDOUYsTUFBTSxtQkFBbUIsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLHFCQUFxQixHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ2pGLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDckUsTUFBTSxLQUFLLEdBQUcsaUJBQWlCLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsaUJBQWlCLEdBQUcsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFFNUcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUNULE9BQU87Z0JBQ1gsQ0FBQztnQkFFRCxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUMxQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztnQkFDdkQsSUFBSSxlQUFzRCxDQUFDO2dCQUUzRCxJQUFJLENBQUM7b0JBQ0QseURBQXlEO29CQUN6RCxlQUFlLEdBQUcsTUFBTSxnQ0FBRyxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxJQUFxQixFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUNoSSxDQUFDO2dCQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7b0JBQ2IsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsNENBQTRDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxNQUFNLEtBQUssR0FBRyxDQUFDLENBQUM7Z0JBQzdGLENBQUM7Z0JBRUQsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxlQUFlLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQztnQkFFakgsSUFBSSxlQUFlLEVBQUUsU0FBUyxFQUFFLENBQUM7b0JBQzdCLE1BQU0sT0FBTyxHQUFHLHlCQUF5QixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksR0FBRyxDQUFDO29CQUM3RCxnQkFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDekIsQ0FBQztZQUNMLENBQUM7UUFDTCxDQUFDO1FBRUQsa0RBQWtEO1FBQ2xELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDMUcsTUFBTSxRQUFRLENBQUMsZUFBZSxDQUMxQixRQUFRLEVBQ1Isd0JBQXdCLEVBQ3hCLEVBQUMsTUFBTSxFQUFFLHFCQUFHLENBQUMsTUFBTSxDQUFDLGtCQUFrQixFQUFDLEVBQ3ZDLFNBQVMsRUFDVCxJQUFJLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUN6QyxDQUFDO1FBQ0YsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSw2QkFBNkIsQ0FBQyxDQUFDO1FBQzVGLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVPLEtBQUssQ0FBQyw4QkFBOEIsQ0FDeEMsTUFBYyxFQUNkLFVBQXdCO1FBRXhCLElBQUksQ0FBQztZQUNELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDckYsSUFBQSxxQkFBTSxFQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2pCLE1BQU0sTUFBTSxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxVQUFVLEVBQUUsV0FBVyxDQUFDLEVBQUUsRUFBQyxVQUFVLEVBQUMsQ0FBQyxDQUFDO1lBQ3hGLE9BQU8sRUFBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVEsRUFBQyxDQUFDO1FBQzFFLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDTCxPQUFPLFNBQVMsQ0FBQztRQUNyQixDQUFDO0lBQ0wsQ0FBQztJQUVPLHVCQUF1QixDQUMzQixNQUFjLEVBQ2QsS0FBOEMsRUFDOUMsUUFBaUIsRUFDakIsU0FBa0I7UUFFbEIsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDeEQsTUFBTSxPQUFPLEdBQWtCO1lBQzNCLE1BQU0sRUFBRTtnQkFDSixLQUFLLEVBQUUsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTTtnQkFDakYsaUJBQWlCLEVBQUUsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGtCQUFrQjtnQkFDOUcsY0FBYyxFQUFFLE9BQU8sS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsY0FBYzthQUN2RztTQUNKLENBQUM7UUFFRixJQUFJLFFBQVEsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN6QixPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDdkMsQ0FBQztRQUVELElBQUksU0FBUyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzFCLE9BQU8sQ0FBQyxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDckQsQ0FBQztRQUVELE9BQU8sT0FBTyxDQUFDO0lBQ25CLENBQUM7SUFFVyxBQUFOLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBMkI7UUFDakQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFaEQsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2QsT0FBTztRQUNYLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxlQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FPUyxDQUFDO1FBQ3BFLE1BQU0sRUFBRSxHQUFHLENBQUMsT0FBTyxPQUFPLEtBQUssUUFBUSxJQUFJLE9BQU8sQ0FBQyxFQUFFLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQVcsQ0FBQztRQUN0RyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM3QyxNQUFNLElBQUksR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFtRCxDQUFDO1FBQzdFLE1BQU0sU0FBUyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBSyxXQUFXLENBQUM7UUFDaEQsSUFBSSxLQUF5QixDQUFDO1FBQzlCLElBQUksVUFBOEIsQ0FBQztRQUVuQyxJQUFJLENBQUMsQ0FBQyxNQUFNLFlBQVksZ0JBQU0sQ0FBQyxFQUFFLENBQUM7WUFDOUIsS0FBSyxHQUFHLFdBQVcsRUFBRSxrQkFBa0IsQ0FBQztRQUM1QyxDQUFDO2FBQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3RELEtBQUssR0FBRyxXQUFXLE1BQU0sQ0FBQyxJQUFJLGdDQUFnQyxDQUFDO1FBQ25FLENBQUM7YUFBTSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQzlDLDRHQUE0RztZQUM1RyxLQUFLLEdBQUcsdURBQXVELE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQztRQUNsRixDQUFDO2FBQU0sQ0FBQztZQUNKLFFBQVEsSUFBSSxFQUFFLENBQUM7Z0JBQ1gsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUNYLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFFckMsZ0JBQU0sQ0FBQyxJQUFJLENBQUMscUNBQXFDLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO29CQUVqRSxJQUFJLENBQUM7d0JBQ0QsTUFBTSxlQUFlLEdBQUcsTUFBTSxnQ0FBRyxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUM7d0JBRTNHLGdCQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxXQUFXLG1CQUFtQixNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQzt3QkFFcEcsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQzt3QkFDN0YsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQzt3QkFFbEQsTUFBTSxRQUFRLEdBQUcsZUFBSyxDQUFDLFdBQVcsQ0FBNEMsT0FBTyxFQUFFOzRCQUNuRixFQUFFLEVBQUUsRUFBRTs0QkFDTixnQkFBZ0IsRUFBRSxlQUFlLENBQUMsU0FBUzt5QkFDOUMsQ0FBQyxDQUFDO3dCQUVILE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMseUNBQXlDLEVBQUUsSUFBQSwrQ0FBUyxFQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQzVGLENBQUM7b0JBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQzt3QkFDVCxLQUFLLEdBQUcsNENBQTRDLE1BQU0sQ0FBQyxJQUFJLE1BQU8sQ0FBVyxDQUFDLE9BQU8sR0FBRyxDQUFDO3dCQUM3RixVQUFVLEdBQUksQ0FBVyxDQUFDLEtBQUssQ0FBQztvQkFDcEMsQ0FBQztvQkFFRCxNQUFNO2dCQUNWLENBQUM7Z0JBRUQsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUNaLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFFckMsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO3dCQUNqRCxnQkFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsTUFBTSxDQUFDLElBQUksMENBQTBDLENBQUMsQ0FBQztvQkFDaEcsQ0FBQzt5QkFBTSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7d0JBQzFELGdCQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixNQUFNLENBQUMsSUFBSSw0Q0FBNEMsQ0FBQyxDQUFDO29CQUNsRyxDQUFDO29CQUVELGdCQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsTUFBTSxDQUFDLElBQUksUUFBUSxTQUFTLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsUUFBUSxXQUFXLENBQUMsQ0FBQztvQkFFMUYsSUFBSSxDQUFDO3dCQUNELE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBSSxDQUFDLDhCQUE4QixDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQzt3QkFDcEYsTUFBTSxXQUFXLEdBQUcsTUFBTSxnQ0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxhQUFhLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEVBQUU7NEJBQzNHLElBQUksR0FBRyxHQUFHLGNBQWMsTUFBTSxDQUFDLElBQUksUUFBUSxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7NEJBRWxFLElBQUksU0FBUyxFQUFFLENBQUM7Z0NBQ1osR0FBRyxJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDLG9CQUFvQixDQUFDOzRCQUNqRSxDQUFDOzRCQUVELGdCQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDOzRCQUVqQixNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFNBQVMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDO3dCQUM5SCxDQUFDLENBQUMsQ0FBQzt3QkFFSCxJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUUsQ0FBQzs0QkFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO3dCQUNwRCxDQUFDO3dCQUVELGdCQUFNLENBQUMsSUFBSSxDQUFDLHVCQUF1QixNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQzt3QkFDbkQsSUFBSSxDQUFDLG1DQUFtQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO3dCQUNqRCxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FDekIsTUFBTSxFQUNOLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsRUFBQyxTQUFTLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFDLENBQUMsQ0FDekgsQ0FBQzt3QkFFRixNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFFckUsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsV0FBVyxNQUFNLENBQUMsSUFBSSx1QkFBdUIsSUFBQSwrQ0FBUyxFQUFDLFlBQVksQ0FBQyxTQUFTLElBQUEsK0NBQVMsRUFBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBRXpIOzs7MkJBR0c7d0JBQ0gsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsRUFBQyxNQUFNLEVBQUMsQ0FBQyxDQUFDO3dCQUN4QyxJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixFQUFFLENBQUM7d0JBRW5DLE1BQU0sUUFBUSxHQUFHLGVBQUssQ0FBQyxXQUFXLENBQTZDLE9BQU8sRUFBRTs0QkFDcEYsRUFBRSxFQUFFLEVBQUU7NEJBQ04sSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsRUFBQyxpQkFBaUIsRUFBRSxZQUFZLENBQUMsZUFBZSxFQUFFLFNBQVMsRUFBRSxZQUFZLENBQUMsUUFBUSxFQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7NEJBQ3BILEVBQUUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUMsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGVBQWUsRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLFFBQVEsRUFBQyxDQUFDLENBQUMsQ0FBQyxTQUFTO3lCQUMvRyxDQUFDLENBQUM7d0JBRUgsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQywwQ0FBMEMsRUFBRSxJQUFBLCtDQUFTLEVBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztvQkFDN0YsQ0FBQztvQkFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO3dCQUNULGdCQUFNLENBQUMsS0FBSyxDQUFDLGNBQWMsTUFBTSxDQUFDLElBQUksYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUN6RCxLQUFLLEdBQUcsY0FBYyxNQUFNLENBQUMsSUFBSSxhQUFjLENBQVcsQ0FBQyxPQUFPLEdBQUcsQ0FBQzt3QkFDdEUsVUFBVSxHQUFJLENBQVcsQ0FBQyxLQUFLLENBQUM7d0JBRWhDLElBQUksQ0FBQyxtQ0FBbUMsQ0FBQyxNQUFNLENBQUMsQ0FBQzt3QkFDakQsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztvQkFDN0YsQ0FBQztvQkFFRCxNQUFNO2dCQUNWLENBQUM7Z0JBRUQsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUNkLHlFQUF5RTtvQkFDekUsSUFBSSxTQUFTLEVBQUUsQ0FBQzt3QkFDWixJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7NEJBQ2pELGdCQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixNQUFNLENBQUMsSUFBSSwyREFBMkQsQ0FBQyxDQUFDO3dCQUNqSCxDQUFDO3dCQUVELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUNsRCxDQUFDO3lCQUFNLENBQUM7d0JBQ0osSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDOzRCQUNuRCxnQkFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsTUFBTSxDQUFDLElBQUksMkRBQTJELENBQUMsQ0FBQzt3QkFDakgsQ0FBQzt3QkFFRCxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDaEQsQ0FBQztvQkFFRCxnQkFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLE1BQU0sQ0FBQyxJQUFJLFFBQVEsU0FBUyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFNBQVMsdUNBQXVDLENBQUMsQ0FBQztvQkFFekgsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUUvRyxNQUFNLFFBQVEsR0FBRyxlQUFLLENBQUMsV0FBVyxDQUErQyxPQUFPLEVBQUU7d0JBQ3RGLEVBQUUsRUFBRSxFQUFFO3FCQUNULENBQUMsQ0FBQztvQkFFSCxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLDRDQUE0QyxFQUFFLElBQUEsK0NBQVMsRUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUUzRixNQUFNO2dCQUNWLENBQUM7Z0JBRUQsS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDO29CQUNoQixJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7d0JBQ2pELGdCQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixNQUFNLENBQUMsSUFBSSx5QkFBeUIsQ0FBQyxDQUFDO29CQUMvRSxDQUFDO3lCQUFNLElBQUksSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQzt3QkFDMUQsZ0JBQU0sQ0FBQyxJQUFJLENBQUMseUJBQXlCLE1BQU0sQ0FBQyxJQUFJLDJCQUEyQixDQUFDLENBQUM7b0JBQ2pGLENBQUM7b0JBRUQsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUUxRyxNQUFNLFFBQVEsR0FBRyxlQUFLLENBQUMsV0FBVyxDQUFpRCxPQUFPLEVBQUU7d0JBQ3hGLEVBQUUsRUFBRSxFQUFFO3FCQUNULENBQUMsQ0FBQztvQkFFSCxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLDhDQUE4QyxFQUFFLElBQUEsK0NBQVMsRUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUU3RixNQUFNO2dCQUNWLENBQUM7WUFDTCxDQUFDO1lBRUQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzVDLENBQUM7UUFFRCxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQ1IsTUFBTSxRQUFRLEdBQUcsZUFBSyxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBRXZELE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMscUNBQXFDLElBQUksRUFBRSxFQUFFLElBQUEsK0NBQVMsRUFBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQzFGLGdCQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRXBCLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2IsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDN0IsQ0FBQztRQUNMLENBQUM7SUFDTCxDQUFDO0NBQ0o7QUF2WkQsNEJBdVpDO0FBdFd1QjtJQUFuQix3QkFBSTs4Q0FrSUo7QUEwQ1c7SUFBWCx3QkFBSTs4Q0F5TEoifQ==