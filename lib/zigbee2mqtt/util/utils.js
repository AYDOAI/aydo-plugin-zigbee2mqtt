"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seconds = exports.minutes = exports.hours = void 0;
exports.getZigbee2MQTTVersion = getZigbee2MQTTVersion;
exports.isNumericExpose = isNumericExpose;
exports.assertEnumExpose = assertEnumExpose;
exports.assertNumericExpose = assertNumericExpose;
exports.assertBinaryExpose = assertBinaryExpose;
exports.isEnumExpose = isEnumExpose;
exports.isBinaryExpose = isBinaryExpose;
exports.isLightExpose = isLightExpose;
exports.assertString = assertString;
const node_assert_1 = __importDefault(require("node:assert"));
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const es6_1 = __importDefault(require("fast-deep-equal/es6"));
const humanize_duration_1 = __importDefault(require("humanize-duration"));
const data_1 = __importDefault(require("./data"));
const BASE64_IMAGE_REGEX = /data:image\/(?<extension>.+);base64,(?<data>.+)/;
function pad(num) {
    const norm = Math.floor(Math.abs(num));
    return (norm < 10 ? "0" : "") + norm;
}
// construct a local ISO8601 string (instead of UTC-based)
// Example:
//  - ISO8601 (UTC) = 2019-03-01T15:32:45.941+0000
//  - ISO8601 (local) = 2019-03-01T16:32:45.941+0100 (for timezone GMT+1)
function toLocalISOString(date) {
    const tzOffset = -date.getTimezoneOffset();
    const plusOrMinus = tzOffset >= 0 ? "+" : "-";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${plusOrMinus}${pad(tzOffset / 60)}:${pad(tzOffset % 60)}`;
}
function capitalize(s) {
    return s[0].toUpperCase() + s.slice(1);
}
async function getZigbee2MQTTVersion(includeCommitHash = true) {
    const packageJSON = (await import("../../../package.json", { with: { type: "json" } })).default;
    const version = packageJSON.version;
    let commitHash;
    if (!includeCommitHash) {
        return { version, commitHash };
    }
    return await new Promise((resolve) => {
        (0, node_child_process_1.exec)("git rev-parse --short=8 HEAD", (error, stdout) => {
            commitHash = stdout.trim();
            if (error || commitHash === "") {
                try {
                    commitHash = node_fs_1.default.readFileSync(node_path_1.default.join(__dirname, "..", "..", "dist", ".hash"), "utf-8");
                }
                catch {
                    commitHash = "unknown";
                }
            }
            resolve({ commitHash, version });
        });
    });
}
async function getDependencyVersion(depend) {
    const packageJSON = (await import(`${depend}/package.json`, { with: { type: "json" } })).default;
    return { version: packageJSON.version };
}
function formatDate(time, type) {
    switch (type) {
        case "ISO_8601":
            // ISO8601 (UTC) = 2019-03-01T15:32:45.941Z
            return new Date(time).toISOString();
        case "ISO_8601_local":
            // ISO8601 (local) = 2019-03-01T16:32:45.941+01:00 (for timezone GMT+1)
            return toLocalISOString(new Date(time));
        case "epoch":
            return time;
        default:
            // relative
            return `${(0, humanize_duration_1.default)(Date.now() - time, { language: "en", largest: 2, round: true })} ago`;
    }
}
function objectIsEmpty(object) {
    // much faster than checking `Object.keys(object).length`
    for (const _k in object)
        return false;
    return true;
}
function objectHasProperties(object, properties) {
    for (const property of properties) {
        if (object[property] === undefined) {
            return false;
        }
    }
    return true;
}
function equalsPartial(object, expected) {
    for (const [key, value] of Object.entries(expected)) {
        if (!(0, es6_1.default)(object[key], value)) {
            return false;
        }
    }
    return true;
}
function getObjectProperty(object, key, defaultValue) {
    return object && object[key] !== undefined ? object[key] : defaultValue;
}
function getResponse(request, data, error) {
    if (error !== undefined) {
        const response = {
            data: {}, // always return an empty `data` payload on error
            status: "error",
            error: error,
        };
        if (typeof request === "object" && request.transaction !== undefined) {
            response.transaction = request.transaction;
        }
        return response;
    }
    const response = {
        data, // valid from error check
        status: "ok",
    };
    if (typeof request === "object" && request.transaction !== undefined) {
        response.transaction = request.transaction;
    }
    return response;
}
function parseJSON(value, fallback) {
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
}
/**
 * Delete all keys from passed object that have null/undefined values.
 *
 * @param {KeyValue} obj Object to process (in-place)
 * @param {string[]} [ignoreKeys] Recursively ignore these keys in the object (keep null/undefined values).
 */
function removeNullPropertiesFromObject(obj, ignoreKeys = []) {
    for (const key of Object.keys(obj)) {
        if (ignoreKeys.includes(key)) {
            continue;
        }
        const value = obj[key];
        if (value == null) {
            delete obj[key];
        }
        else if (typeof value === "object") {
            removeNullPropertiesFromObject(value, ignoreKeys);
        }
    }
}
function toNetworkAddressHex(value) {
    const hex = value.toString(16);
    return `0x${"0".repeat(4 - hex.length)}${hex}`;
}
function charRange(start, stop) {
    const result = [];
    for (let idx = start.charCodeAt(0), end = stop.charCodeAt(0); idx <= end; ++idx) {
        result.push(idx);
    }
    return result;
}
const controlCharacters = [...charRange("\u0000", "\u001F"), ...charRange("\u007f", "\u009F"), ...charRange("\ufdd0", "\ufdef")];
function containsControlCharacter(str) {
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        if (controlCharacters.includes(ch) || [0xfffe, 0xffff].includes(ch & 0xffff)) {
            return true;
        }
    }
    return false;
}
function getAllFiles(path_) {
    const result = [];
    for (let item of node_fs_1.default.readdirSync(path_)) {
        item = node_path_1.default.join(path_, item);
        if (node_fs_1.default.lstatSync(item).isFile()) {
            result.push(item);
        }
        else {
            result.push(...getAllFiles(item));
        }
    }
    return result;
}
function validateFriendlyName(name, throwFirstError = false) {
    const errors = [];
    if (name.length === 0)
        errors.push("friendly_name must be at least 1 char long");
    if (name.endsWith("/") || name.startsWith("/"))
        errors.push("friendly_name is not allowed to end or start with /");
    if (containsControlCharacter(name))
        errors.push("friendly_name is not allowed to contain control char");
    if (name.match(/.*\/\d*$/))
        errors.push(`Friendly name cannot end with a "/DIGIT" ('${name}')`);
    if (name.includes("#") || name.includes("+")) {
        errors.push(`MQTT wildcard (+ and #) not allowed in friendly_name ('${name}')`);
    }
    if (throwFirstError && errors.length) {
        throw new Error(errors[0]);
    }
    return errors;
}
function sleep(seconds) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
function sanitizeImageParameter(parameter) {
    return parameter.replace(/\?|&|[^a-z\d\- _./:]/gi, "-");
}
function isAvailabilityEnabledForEntity(entity, settings) {
    if (entity.isDevice() && entity.options.disabled) {
        return false;
    }
    if (entity.isGroup()) {
        for (const memberDevice of entity.membersDevices()) {
            if (!isAvailabilityEnabledForEntity(memberDevice, settings)) {
                return false;
            }
        }
        return true;
    }
    if (entity.options.availability != null) {
        return !!entity.options.availability;
    }
    return settings.availability.enabled;
}
function isZHEndpoint(obj) {
    return obj?.constructor.name.toLowerCase() === "endpoint";
}
function flatten(arr) {
    return [].concat(...arr);
}
function arrayUnique(arr) {
    return [...new Set(arr)];
}
function isZHGroup(obj) {
    return obj?.constructor.name.toLowerCase() === "group";
}
const hours = (hours) => 1000 * 60 * 60 * hours;
exports.hours = hours;
const minutes = (minutes) => 1000 * 60 * minutes;
exports.minutes = minutes;
const seconds = (seconds) => 1000 * seconds;
exports.seconds = seconds;
async function publishLastSeen(data, settings, allowMessageEmitted, publishEntityState) {
    /**
     * Prevent 2 MQTT publishes when 1 message event is received;
     * - In case reason == messageEmitted, receive.ts will only call this when it did not publish a
     *      message based on the received zigbee message. In this case allowMessageEmitted has to be true.
     * - In case reason !== messageEmitted, controller.ts will call this based on the zigbee-herdsman
     *      lastSeenChanged event.
     */
    const allow = data.reason !== "messageEmitted" || (data.reason === "messageEmitted" && allowMessageEmitted);
    if (settings.advanced.last_seen && settings.advanced.last_seen !== "disable" && allow) {
        await publishEntityState(data.device, {}, "lastSeenChanged");
    }
}
function filterProperties(filter, data) {
    if (filter) {
        for (const property of Object.keys(data)) {
            if (filter.find((p) => property.match(`^${p}$`))) {
                delete data[property];
            }
        }
    }
}
function isNumericExpose(expose) {
    return expose?.type === "numeric";
}
function assertEnumExpose(expose) {
    (0, node_assert_1.default)(expose?.type === "enum");
}
function assertNumericExpose(expose) {
    (0, node_assert_1.default)(expose?.type === "numeric");
}
function assertBinaryExpose(expose) {
    (0, node_assert_1.default)(expose?.type === "binary");
}
function isEnumExpose(expose) {
    return expose?.type === "enum";
}
function isBinaryExpose(expose) {
    return expose?.type === "binary";
}
function isLightExpose(expose) {
    return expose.type === "light";
}
function assertString(value, property) {
    if (typeof value !== "string") {
        throw new Error(`${property} is not a string, got ${typeof value} (${value})`);
    }
}
function getScenes(entity) {
    const scenes = {};
    const endpoints = isZHEndpoint(entity) ? [entity] : entity.members;
    const groupID = isZHEndpoint(entity) ? 0 : entity.groupID;
    for (const endpoint of endpoints) {
        for (const [key, data] of Object.entries(endpoint.meta?.scenes || {})) {
            const split = key.split("_");
            const sceneID = Number.parseInt(split[0], 10);
            const sceneGroupID = Number.parseInt(split[1], 10);
            if (sceneGroupID === groupID) {
                scenes[sceneID] = { id: sceneID, name: data.name || `Scene ${sceneID}` };
            }
        }
    }
    return Object.values(scenes);
}
function deviceNotCoordinator(device) {
    return device.type !== "Coordinator";
}
function matchBase64File(value) {
    if (value !== undefined) {
        const match = value.match(BASE64_IMAGE_REGEX);
        if (match) {
            (0, node_assert_1.default)(match.groups?.extension && match.groups?.data);
            return { extension: match.groups.extension, data: match.groups.data };
        }
    }
    return false;
}
function saveBase64DeviceIcon(base64Match) {
    const md5Hash = node_crypto_1.default.createHash("md5").update(base64Match.data).digest("hex");
    const fileSettings = `device_icons/${md5Hash}.${base64Match.extension}`;
    const file = node_path_1.default.join(data_1.default.getPath(), fileSettings);
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(file), { recursive: true });
    node_fs_1.default.writeFileSync(file, base64Match.data, { encoding: "base64" });
    return fileSettings;
}
/* v8 ignore next */
const noop = () => { };
exports.default = {
    matchBase64File,
    saveBase64DeviceIcon,
    capitalize,
    getZigbee2MQTTVersion,
    getDependencyVersion,
    formatDate,
    objectIsEmpty,
    objectHasProperties,
    equalsPartial,
    getObjectProperty,
    getResponse,
    parseJSON,
    removeNullPropertiesFromObject,
    toNetworkAddressHex,
    isZHEndpoint,
    isZHGroup,
    hours: exports.hours,
    minutes: exports.minutes,
    seconds: exports.seconds,
    validateFriendlyName,
    sleep,
    sanitizeImageParameter,
    isAvailabilityEnabledForEntity,
    publishLastSeen,
    getAllFiles,
    filterProperties,
    flatten,
    arrayUnique,
    getScenes,
    deviceNotCoordinator,
    noop,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdXRpbC91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFrQ0Esc0RBd0JDO0FBNFBELDBDQUVDO0FBRUQsNENBRUM7QUFFRCxrREFFQztBQUVELGdEQUVDO0FBRUQsb0NBRUM7QUFFRCx3Q0FFQztBQUVELHNDQUVDO0FBRUQsb0NBSUM7QUF0VkQsOERBQWlDO0FBQ2pDLDJEQUF3QztBQUN4Qyw4REFBaUM7QUFDakMsc0RBQXlCO0FBQ3pCLDBEQUE2QjtBQUM3Qiw4REFBeUM7QUFDekMsMEVBQWlEO0FBSWpELGtEQUEwQjtBQUUxQixNQUFNLGtCQUFrQixHQUFHLGlEQUFpRCxDQUFDO0FBRTdFLFNBQVMsR0FBRyxDQUFDLEdBQVc7SUFDcEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDdkMsT0FBTyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDO0FBQ3pDLENBQUM7QUFFRCwwREFBMEQ7QUFDMUQsV0FBVztBQUNYLGtEQUFrRDtBQUNsRCx5RUFBeUU7QUFDekUsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFVO0lBQ2hDLE1BQU0sUUFBUSxHQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDM0MsTUFBTSxXQUFXLEdBQUcsUUFBUSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7SUFFOUMsT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMs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