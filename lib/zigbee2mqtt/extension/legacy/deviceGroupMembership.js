"use strict";
/* istanbul ignore file */
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const device_1 = __importDefault(require("../../model/device"));
const logger_1 = __importDefault(require("../../util/logger"));
const settings = __importStar(require("../../util/settings"));
const extension_1 = __importDefault(require("../extension"));
const topicRegex = new RegExp(`^${settings.get().mqtt.base_topic}/bridge/device/(.+)/get_group_membership$`);
class DeviceGroupMembership extends extension_1.default {
    async start() {
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
    }
    async onMQTTMessage(data) {
        const match = data.topic.match(topicRegex);
        if (!match) {
            return;
        }
        const parsed = this.zigbee.resolveEntityAndEndpoint(match[1]);
        const device = parsed?.entity;
        if (!device || !(device instanceof device_1.default)) {
            logger_1.default.error(`Device '${match[1]}' does not exist`);
            return;
        }
        const endpoint = parsed.endpoint;
        if (parsed.endpointID && !endpoint) {
            logger_1.default.error(`Device '${parsed.ID}' does not have endpoint '${parsed.endpointID}'`);
            return;
        }
        (0, assert_1.default)(endpoint !== undefined);
        const response = await endpoint.command(`genGroups`, 'getMembership', { groupcount: 0, grouplist: [] }, {});
        if (!response) {
            logger_1.default.warning(`Couldn't get group membership of ${device.ieeeAddr}`);
            return;
        }
        let { grouplist } = response;
        grouplist = grouplist.map((gid) => {
            const g = settings.getGroup(gid);
            return g ? g.friendly_name : gid;
        });
        const msgGroupList = `${device.ieeeAddr} is in groups [${grouplist}]`;
        let msgCapacity;
        if (response.capacity === 254) {
            msgCapacity = 'it can be a part of at least 1 more group';
        }
        else {
            msgCapacity = `its remaining group capacity is ${response.capacity === 255 ? 'unknown' : response.capacity}`;
        }
        logger_1.default.info(`${msgGroupList} and ${msgCapacity}`);
        await this.publishEntityState(device, { group_list: grouplist, group_capacity: response.capacity });
    }
}
exports.default = DeviceGroupMembership;
__decorate([
    bind_decorator_1.default
], DeviceGroupMembership.prototype, "onMQTTMessage", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlR3JvdXBNZW1iZXJzaGlwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL2V4dGVuc2lvbi9sZWdhY3kvZGV2aWNlR3JvdXBNZW1iZXJzaGlwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSwwQkFBMEI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFMUIsb0RBQTRCO0FBRTVCLG9FQUFrQztBQUVsQyxnRUFBd0M7QUFDeEMsK0RBQXVDO0FBQ3ZDLDhEQUFnRDtBQUNoRCw2REFBcUM7QUFFckMsTUFBTSxVQUFVLEdBQUcsSUFBSSxNQUFNLENBQUMsSUFBSSxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsMkNBQTJDLENBQUMsQ0FBQztBQUU3RyxNQUFxQixxQkFBc0IsU0FBUSxtQkFBUztJQUMvQyxLQUFLLENBQUMsS0FBSztRQUNoQixJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFVyxBQUFOLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBMkI7UUFDakQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFM0MsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1QsT0FBTztRQUNYLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLHdCQUF3QixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlELE1BQU0sTUFBTSxHQUFHLE1BQU0sRUFBRSxNQUFnQixDQUFDO1FBRXhDLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLE1BQU0sWUFBWSxnQkFBTSxDQUFDLEVBQUUsQ0FBQztZQUN6QyxnQkFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLEtBQUssQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUNwRCxPQUFPO1FBQ1gsQ0FBQztRQUVELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUM7UUFFakMsSUFBSSxNQUFNLENBQUMsVUFBVSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDakMsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxNQUFNLENBQUMsRUFBRSw2QkFBNkIsTUFBTSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUM7WUFDcEYsT0FBTztRQUNYLENBQUM7UUFFRCxJQUFBLGdCQUFNLEVBQUMsUUFBUSxLQUFLLFNBQVMsQ0FBQyxDQUFDO1FBQy9CLE1BQU0sUUFBUSxHQUFHLE1BQU0sUUFBUSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsZUFBZSxFQUFFLEVBQUMsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFMUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ1osZ0JBQU0sQ0FBQyxPQUFPLENBQUMsb0NBQW9DLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3RFLE9BQU87UUFDWCxDQUFDO1FBRUQsSUFBSSxFQUFDLFNBQVMsRUFBQyxHQUFHLFFBQVEsQ0FBQztRQUUzQixTQUFTLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQVcsRUFBRSxFQUFFO1lBQ3RDLE1BQU0sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDakMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztRQUNyQyxDQUFDLENBQUMsQ0FBQztRQUVILE1BQU0sWUFBWSxHQUFHLEdBQUcsTUFBTSxDQUFDLFFBQVEsa0JBQWtCLFNBQVMsR0FBRyxDQUFDO1FBQ3RFLElBQUksV0FBVyxDQUFDO1FBQ2hCLElBQUksUUFBUSxDQUFDLFFBQVEsS0FBSyxHQUFHLEVBQUUsQ0FBQztZQUM1QixXQUFXLEdBQUcsMkNBQTJDLENBQUM7UUFDOUQsQ0FBQzthQUFNLENBQUM7WUFDSixXQUFXLEdBQUcsbUNBQW1DLFFBQVEsQ0FBQyxRQUFRLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNqSCxDQUFDO1FBQ0QsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxZQUFZLFFBQVEsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUVsRCxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsRUFBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxRQUFRLENBQUMsUUFBUSxFQUFDLENBQUMsQ0FBQztJQUN0RyxDQUFDO0NBQ0o7QUFyREQsd0NBcURDO0FBaERlO0lBQVgsd0JBQUk7MERBK0NKIn0=