"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zigbee_herdsman_converters_1 = require("zigbee-herdsman-converters");
const utils_1 = __importDefault(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
/**
 * This extension calls the zigbee-herdsman-converters onEvent.
 */
class OnEvent extends extension_1.default {
    // biome-ignore lint/suspicious/useAwait: API
    async start() {
        for (const device of this.zigbee.devicesIterator(utils_1.default.deviceNotCoordinator)) {
            // don't await, in case of repeated failures this would hold startup
            this.callOnEvent(device, "start", {}).catch(utils_1.default.noop);
        }
        this.eventBus.onDeviceMessage(this, async (data) => {
            await this.callOnEvent(data.device, "message", {
                endpoint: data.endpoint,
                meta: data.meta,
                cluster: typeof data.cluster === "string" ? data.cluster : /* v8 ignore next */ undefined, // XXX: ZH typing is wrong?
                type: data.type,
                data: data.data, // XXX: typing is a bit convoluted: ZHC has `KeyValueAny` here while Z2M has `KeyValue | Array<string | number>`
            });
        });
        this.eventBus.onDeviceJoined(this, async (data) => {
            await this.callOnEvent(data.device, "deviceJoined", {});
        });
        this.eventBus.onDeviceLeave(this, async (data) => {
            if (data.device) {
                await this.callOnEvent(data.device, "stop", {});
            }
        });
        this.eventBus.onDeviceInterview(this, async (data) => {
            await this.callOnEvent(data.device, "deviceInterview", {});
        });
        this.eventBus.onDeviceAnnounce(this, async (data) => {
            await this.callOnEvent(data.device, "deviceAnnounce", {});
        });
        this.eventBus.onDeviceNetworkAddressChanged(this, async (data) => {
            await this.callOnEvent(data.device, "deviceNetworkAddressChanged", {});
        });
        this.eventBus.onEntityOptionsChanged(this, async (data) => {
            if (data.entity.isDevice()) {
                await this.callOnEvent(data.entity, "deviceOptionsChanged", {});
                this.eventBus.emitDevicesChanged();
            }
        });
    }
    async stop() {
        await super.stop();
        for (const device of this.zigbee.devicesIterator(utils_1.default.deviceNotCoordinator)) {
            await this.callOnEvent(device, "stop", {});
        }
    }
    async callOnEvent(device, type, data) {
        if (device.options.disabled) {
            return;
        }
        const state = this.state.get(device);
        const deviceExposesChanged = () => this.eventBus.emitExposesAndDevicesChanged(device);
        await (0, zigbee_herdsman_converters_1.onEvent)(type, data, device.zh, { deviceExposesChanged });
        if (device.definition?.onEvent) {
            const options = device.options;
            await device.definition.onEvent(type, data, device.zh, options, state, { deviceExposesChanged });
        }
    }
}
exports.default = OnEvent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib25FdmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9leHRlbnNpb24vb25FdmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDJFQUFtRDtBQUVuRCwwREFBa0M7QUFDbEMsNERBQW9DO0FBRXBDOztHQUVHO0FBQ0gsTUFBcUIsT0FBUSxTQUFRLG1CQUFTO0lBQzFDLDZDQUE2QztJQUNwQyxLQUFLLENBQUMsS0FBSztRQUNoQixLQUFLLE1BQU0sTUFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLGVBQUssQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFLENBQUM7WUFDM0Usb0VBQW9FO1lBQ3BFLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsZUFBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFFRCxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFFO1lBQy9DLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRTtnQkFDM0MsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO2dCQUN2QixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7Z0JBQ2YsT0FBTyxFQUFFLE9BQU8sSUFBSSxDQUFDLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSwyQkFBMkI7Z0JBQ3RILElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtnQkFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxnSEFBZ0g7YUFDcEksQ0FBQyxDQUFDO1FBQ1AsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FB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