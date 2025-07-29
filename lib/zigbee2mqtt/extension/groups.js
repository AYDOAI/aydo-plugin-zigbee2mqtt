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
const es6_1 = __importDefault(require("fast-deep-equal/es6"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const device_1 = __importDefault(require("../model/device"));
const group_1 = __importDefault(require("../model/group"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importStar(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
const TOPIC_REGEX = new RegExp(`^${settings.get().mqtt.base_topic}/bridge/request/group/members/(remove|add|remove_all)$`);
const STATE_PROPERTIES = {
    state: () => true,
    brightness: (_value, exposes) => exposes.some((e) => (0, utils_1.isLightExpose)(e) && e.features.some((f) => f.name === "brightness")),
    color_temp: (_value, exposes) => exposes.some((e) => (0, utils_1.isLightExpose)(e) && e.features.some((f) => f.name === "color_temp")),
    color: (_value, exposes) => exposes.some((e) => (0, utils_1.isLightExpose)(e) && e.features.some((f) => f.name === "color_xy" || f.name === "color_hs")),
    color_mode: (value, exposes) => exposes.some((e) => (0, utils_1.isLightExpose)(e) &&
        (e.features.some((f) => f.name === `color_${value}`) || (value === "color_temp" && e.features.some((f) => f.name === "color_temp")))),
};
class Groups extends extension_1.default {
    lastOptimisticState = {};
    // biome-ignore lint/suspicious/useAwait: API
    async start() {
        this.eventBus.onStateChange(this, this.onStateChange);
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
    }
    async onStateChange(data) {
        const reason = "groupOptimistic";
        if (data.reason === reason || data.reason === "publishCached") {
            return;
        }
        const payload = {};
        let endpointName;
        const endpointNames = data.entity instanceof device_1.default ? data.entity.getEndpointNames() : [];
        for (let prop of Object.keys(data.update)) {
            const value = data.update[prop];
            const endpointNameMatch = endpointNames.find((n) => prop.endsWith(`_${n}`));
            if (endpointNameMatch) {
                prop = prop.substring(0, prop.length - endpointNameMatch.length - 1);
                endpointName = endpointNameMatch;
            }
            if (prop in STATE_PROPERTIES) {
                payload[prop] = value;
            }
        }
        const payloadKeys = Object.keys(payload);
        if (payloadKeys.length) {
            const entity = data.entity;
            const groups = [];
            for (const group of this.zigbee.groupsIterator()) {
                if (group.options && (group.options.optimistic == null || group.options.optimistic)) {
                    groups.push(group);
                }
            }
            if (entity instanceof device_1.default) {
                const endpoint = entity.endpoint(endpointName);
                if (endpoint) {
                    for (const group of groups) {
                        if (group.zh.hasMember(endpoint) &&
                            !(0, es6_1.default)(this.lastOptimisticState[group.ID], payload) &&
                            this.shouldPublishPayloadForGroup(group, payload)) {
                            this.lastOptimisticState[group.ID] = payload;
                            await this.publishEntityState(group, payload, reason);
                        }
                    }
                }
            }
            else {
                // Invalidate the last optimistic group state when group state is changed directly.
                delete this.lastOptimisticState[entity.ID];
                const groupsToPublish = new Set();
                for (const member of entity.zh.members) {
                    const device = this.zigbee.resolveEntity(member.getDevice());
                    if (device.options.disabled) {
                        continue;
                    }
                    const exposes = device.exposes();
                    const memberPayload = {};
                    for (const key of payloadKeys) {
                        if (STATE_PROPERTIES[key](payload[key], exposes)) {
                            memberPayload[key] = payload[key];
                        }
                    }
                    const endpointName = device.endpointName(member);
                    if (endpointName) {
                        for (const key of Object.keys(memberPayload)) {
                            memberPayload[`${key}_${endpointName}`] = memberPayload[key];
                            delete memberPayload[key];
                        }
                    }
                    await this.publishEntityState(device, memberPayload, reason);
                    for (const zigbeeGroup of groups) {
                        if (zigbeeGroup.zh.hasMember(member) && this.shouldPublishPayloadForGroup(zigbeeGroup, payload)) {
                            groupsToPublish.add(zigbeeGroup);
                        }
                    }
                }
                groupsToPublish.delete(entity);
                for (const group of groupsToPublish) {
                    await this.publishEntityState(group, payload, reason);
                }
            }
        }
    }
    shouldPublishPayloadForGroup(group, payload) {
        return (group.options.off_state === "last_member_state" ||
            !payload ||
            (payload.state !== "OFF" && payload.state !== "CLOSE") ||
            this.areAllMembersOffOrClosed(group));
    }
    areAllMembersOffOrClosed(group) {
        for (const member of group.zh.members) {
            // biome-ignore lint/style/noNonNullAssertion: TODO: biome migration: valid from loop?
            const device = this.zigbee.resolveEntity(member.getDevice());
            if (this.state.exists(device)) {
                const state = this.state.get(device);
                const endpointNames = device.isDevice() && device.getEndpointNames();
                const stateKey = endpointNames &&
                    endpointNames.length >= member.ID &&
                    device.definition?.meta?.multiEndpoint &&
                    (!device.definition.meta.multiEndpointSkip || !device.definition.meta.multiEndpointSkip.includes("state"))
                    ? `state_${endpointNames[member.ID - 1]}`
                    : "state";
                if (state[stateKey] === "ON" || state[stateKey] === "OPEN") {
                    return false;
                }
            }
        }
        return true;
    }
    parseMQTTMessage(data) {
        const topicRegexMatch = data.topic.match(TOPIC_REGEX);
        if (topicRegexMatch) {
            const type = topicRegexMatch[1];
            let resolvedGroup;
            let groupKey;
            let skipDisableReporting = false;
            const message = JSON.parse(data.message);
            if (typeof message !== "object" || message.device == null) {
                return [message, { type, skipDisableReporting }, "Invalid payload"];
            }
            const deviceKey = message.device;
            skipDisableReporting = message.skip_disable_reporting != null ? message.skip_disable_reporting : false;
            if (type !== "remove_all") {
                if (!("group" in message) || message.group == null) {
                    return [message, { type, skipDisableReporting }, "Invalid payload"];
                }
                groupKey = message.group;
                const group = this.zigbee.resolveEntity(message.group);
                if (!group || !(group instanceof group_1.default)) {
                    return [message, { type, skipDisableReporting }, `Group '${message.group}' does not exist`];
                }
                resolvedGroup = group;
            }
            const resolvedDevice = this.zigbee.resolveEntity(message.device);
            if (!resolvedDevice || !(resolvedDevice instanceof device_1.default)) {
                return [message, { type, skipDisableReporting }, `Device '${message.device}' does not exist`];
            }
            const endpointKey = message.endpoint ?? "default";
            const resolvedEndpoint = resolvedDevice.endpoint(message.endpoint);
            if (!resolvedEndpoint) {
                return [message, { type, skipDisableReporting }, `Device '${resolvedDevice.name}' does not have endpoint '${endpointKey}'`];
            }
            return [
                message,
                {
                    resolvedGroup,
                    resolvedDevice,
                    resolvedEndpoint,
                    type,
                    groupKey,
                    deviceKey,
                    endpointKey,
                    skipDisableReporting,
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
        const { resolvedGroup, resolvedDevice, resolvedEndpoint, type, groupKey, deviceKey, endpointKey, skipDisableReporting } = parsed;
        const changedGroups = [];
        (0, node_assert_1.default)(resolvedDevice, "`resolvedDevice` is missing");
        (0, node_assert_1.default)(resolvedEndpoint, "`resolvedEndpoint` is missing");
        try {
            if (type === "add") {
                (0, node_assert_1.default)(resolvedGroup, "`resolvedGroup` is missing");
                logger_1.default.info(`Adding '${resolvedDevice.name}' to '${resolvedGroup.name}'`);
                await resolvedEndpoint.addToGroup(resolvedGroup.zh);
                changedGroups.push(resolvedGroup);
                // biome-ignore lint/style/noNonNullAssertion: valid from resolved asserts
                const respPayload = { device: deviceKey, endpoint: endpointKey, group: groupKey };
                await this.publishResponse(parsed.type, raw, respPayload);
            }
            else if (type === "remove") {
                (0, node_assert_1.default)(resolvedGroup, "`resolvedGroup` is missing");
                logger_1.default.info(`Removing '${resolvedDevice.name}' from '${resolvedGroup.name}'`);
                await resolvedEndpoint.removeFromGroup(resolvedGroup.zh);
                changedGroups.push(resolvedGroup);
                // biome-ignore lint/style/noNonNullAssertion: valid from resolved asserts
                const respPayload = { device: deviceKey, endpoint: endpointKey, group: groupKey };
                await this.publishResponse(parsed.type, raw, respPayload);
            }
            else {
                // remove_all
                logger_1.default.info(`Removing '${resolvedDevice.name}' from all groups`);
                for (const group of this.zigbee.groupsIterator((g) => g.members.includes(resolvedEndpoint))) {
                    changedGroups.push(group);
                }
                await resolvedEndpoint.removeFromAllGroups();
                // biome-ignore lint/style/noNonNullAssertion: valid from resolved asserts
                const respPayload = { device: deviceKey, endpoint: endpointKey };
                await this.publishResponse(parsed.type, raw, respPayload);
            }
        }
        catch (e) {
            const errorMsg = `Failed to ${type} from group (${e.message})`;
            await this.publishResponse(parsed.type, raw, {}, errorMsg);
            // biome-ignore lint/style/noNonNullAssertion: always Error
            logger_1.default.debug(e.stack);
            return;
        }
        for (const group of changedGroups) {
            this.eventBus.emitGroupMembersChanged({ group, action: type, endpoint: resolvedEndpoint, skipDisableReporting });
        }
    }
    async publishResponse(type, request, data, error) {
        const response = utils_1.default.getResponse(request, data, error);
        await this.mqtt.publish(`bridge/response/group/members/${type}`, (0, json_stable_stringify_without_jsonify_1.default)(response));
        if (error) {
            logger_1.default.error(error);
        }
    }
}
exports.default = Groups;
__decorate([
    bind_decorator_1.default
], Groups.prototype, "onStateChange", null);
__decorate([
    bind_decorator_1.default
], Groups.prototype, "onMQTTMessage", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXBzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9ncm91cHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw4REFBaUM7QUFDakMsb0VBQWtDO0FBQ2xDLDhEQUF5QztBQUN6QyxrSEFBOEQ7QUFFOUQsNkRBQXFDO0FBQ3JDLDJEQUFtQztBQUVuQyw0REFBb0M7QUFDcEMsMkRBQTZDO0FBQzdDLHVEQUFtRDtBQUNuRCw0REFBb0M7QUFFcEMsTUFBTSxXQUFXLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsd0RBQXdELENBQUMsQ0FBQztBQUUzSCxNQUFNLGdCQUFnQixHQUFnRjtJQUNsRyxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSTtJQUNqQixVQUFVLEVBQUUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFBLHFCQUFhLEVBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssWUFBWSxDQUFDLENBQUM7SUFDekgsVUFBVSxFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBQSxxQkFBYSxFQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFlBQVksQ0FBQyxDQUFDO0lBQ3pILEtBQUssRUFBRSxDQUFD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