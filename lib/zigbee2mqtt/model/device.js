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
const device_1 = require("zigbee-herdsman/dist/controller/model/device");
const zhc = __importStar(require("zigbee-herdsman-converters"));
const zigbee_herdsman_converters_1 = require("zigbee-herdsman-converters");
const settings = __importStar(require("../util/settings"));
const LINKQUALITY = new zigbee_herdsman_converters_1.Numeric("linkquality", zigbee_herdsman_converters_1.access.STATE)
    .withUnit("lqi")
    .withDescription("Link quality (signal strength)")
    .withValueMin(0)
    .withValueMax(255)
    .withCategory("diagnostic");
class Device {
    zh;
    definition;
    _definitionModelID;
    get ieeeAddr() {
        return this.zh.ieeeAddr;
    }
    // biome-ignore lint/style/useNamingConvention: API
    get ID() {
        return this.zh.ieeeAddr;
    }
    get options() {
        const deviceOptions = settings.getDevice(this.ieeeAddr) ?? { friendly_name: this.ieeeAddr, ID: this.ieeeAddr };
        return { ...settings.get().device_options, ...deviceOptions };
    }
    get name() {
        return this.zh.type === "Coordinator" ? "Coordinator" : this.options?.friendly_name;
    }
    get isSupported() {
        return this.zh.type === "Coordinator" || Boolean(this.definition && !this.definition.generated);
    }
    get customClusters() {
        return this.zh.customClusters;
    }
    get otaExtraMetas() {
        return typeof this.definition?.ota === "object" ? this.definition.ota : {};
    }
    get interviewed() {
        return this.zh.interviewState === device_1.InterviewState.Successful || this.zh.interviewState === device_1.InterviewState.Failed;
    }
    constructor(device) {
        this.zh = device;
    }
    exposes() {
        const exposes = [];
        (0, node_assert_1.default)(this.definition, "Cannot retreive exposes before definition is resolved");
        if (typeof this.definition.exposes === "function") {
            const options = this.options;
            exposes.push(...this.definition.exposes(this.zh, options));
        }
        else {
            exposes.push(...this.definition.exposes);
        }
        exposes.push(LINKQUALITY);
        return exposes;
    }
    async resolveDefinition(ignoreCache = false) {
        if (this.interviewed && (!this.definition || this._definitionModelID !== this.zh.modelID || ignoreCache)) {
            this.definition = await zhc.findByDevice(this.zh, true);
            this._definitionModelID = this.zh.modelID;
        }
    }
    ensureInSettings() {
        if (this.zh.type !== "Coordinator" && !settings.getDevice(this.zh.ieeeAddr)) {
            settings.addDevice(this.zh.ieeeAddr);
        }
    }
    endpoint(key) {
        let endpoint;
        if (!key) {
            key = "default";
        }
        if (!Number.isNaN(Number(key))) {
            endpoint = this.zh.getEndpoint(Number(key));
        }
        else if (this.definition?.endpoint) {
            const ID = this.definition?.endpoint?.(this.zh)[key];
            if (ID) {
                endpoint = this.zh.getEndpoint(ID);
            }
            else if (key === "default") {
                endpoint = this.zh.endpoints[0];
            }
            else {
                return undefined;
            }
        }
        else {
            if (key !== "default") {
                return undefined;
            }
            endpoint = this.zh.endpoints[0];
        }
        return endpoint;
    }
    endpointName(endpoint) {
        let epName;
        if (this.definition?.endpoint) {
            const mapping = this.definition?.endpoint(this.zh);
            for (const [name, id] of Object.entries(mapping)) {
                if (id === endpoint.ID) {
                    epName = name;
                }
            }
        }
        /* v8 ignore next */
        return epName === "default" ? undefined : epName;
    }
    getEndpointNames() {
        const names = [];
        for (const name in this.definition?.endpoint?.(this.zh) ?? {}) {
            if (name !== "default") {
                names.push(name);
            }
        }
        return names;
    }
    isDevice() {
        return true;
    }
    isGroup() {
        return false;
    }
}
exports.default = Device;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL21vZGVsL2RldmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhEQUFpQztBQUNqQyx5RUFBNEU7QUFFNUUsZ0VBQWtEO0FBQ2xELDJFQUEyRDtBQUUzRCwyREFBNkM7QUFFN0MsTUFBTSxXQUFXLEdBQUcsSUFBSSxvQ0FBTyxDQUFDLGFBQWEsRUFBRSxtQ0FBTSxDQUFDLEtBQUssQ0FBQztLQUN2RCxRQUFRLENBQUMsS0FBSyxDQUFDO0tBQ2YsZUFBZSxDQUFDLGdDQUFnQyxDQUFDO0tBQ2pELFlBQVksQ0FBQyxDQUFDLENBQUM7S0FDZixZQUFZLENBQUMsR0FBRyxDQUFDO0tBQ2pCLFlBQVksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUVoQyxNQUFxQixNQUFNO0lBQ2hCLEVBQUUsQ0FBWTtJQUNkLFVBQVUsQ0FBa0I7SUFDM0Isa0JBQWtCLENBQVU7SUFFcEMsSUFBSSxRQUFRO1FBQ1IsT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQztJQUM1QixDQUFDO0lBQ0QsbURBQW1EO0lBQ25ELElBQUksRUFBRTtRQUNGLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUM7SUFDNUIsQ0FBQztJQUNELElBQUksT0FBTztRQUNQLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUMsQ0FBQztRQUM3RyxPQUFPLEVBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsY0FBYyxFQUFFLEdBQUcsYUFBYSxFQUFDLENBQUM7SUFDaEUsQ0FBQztJQUNELElBQUksSUFBSTtRQUNKLE9BQU8sSUFBSSxDQUFD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