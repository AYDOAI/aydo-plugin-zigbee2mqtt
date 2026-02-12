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
exports.testing = exports.defaults = exports.LOG_LEVELS = exports.CURRENT_VERSION = exports.schemaJson = void 0;
exports.writeMinimalDefaults = writeMinimalDefaults;
exports.setOnboarding = setOnboarding;
exports.write = write;
exports.validate = validate;
exports.getPersistedSettings = getPersistedSettings;
exports.get = get;
exports.set = set;
exports.apply = apply;
exports.getGroup = getGroup;
exports.getDevice = getDevice;
exports.addDevice = addDevice;
exports.blockDevice = blockDevice;
exports.removeDevice = removeDevice;
exports.addGroup = addGroup;
exports.removeGroup = removeGroup;
exports.changeEntityOptions = changeEntityOptions;
exports.changeFriendlyName = changeFriendlyName;
exports.reRead = reRead;
const node_path_1 = __importDefault(require("node:path"));
const ajv_1 = __importDefault(require("ajv"));
const object_assign_deep_1 = __importDefault(require("object-assign-deep"));
const data_1 = __importDefault(require("./data"));
const settings_schema_json_1 = __importDefault(require("./settings.schema.json"));
exports.schemaJson = settings_schema_json_1.default;
const utils_1 = __importDefault(require("./utils"));
const yaml_1 = __importStar(require("./yaml"));
// When updating also update:
// - https://github.com/Koenkk/zigbee2mqtt/blob/dev/data/configuration.example.yaml#L2
exports.CURRENT_VERSION = 4;
/** NOTE: by order of priority, lower index is lower level (more important) */
exports.LOG_LEVELS = ["error", "warning", "info", "debug"];
const CONFIG_FILE_PATH = data_1.default.joinPath("configuration.yaml");
const NULLABLE_SETTINGS = ["homeassistant"];
const ajvSetting = new ajv_1.default({ allErrors: true }).addKeyword("requiresRestart").compile(settings_schema_json_1.default);
const ajvRestartRequired = new ajv_1.default({ allErrors: true }).addKeyword({ keyword: "requiresRestart", validate: (s) => !s }).compile(settings_schema_json_1.default);
const ajvRestartRequiredDeviceOptions = new ajv_1.default({ allErrors: true })
    .addKeyword({ keyword: "requiresRestart", validate: (s) => !s })
    .compile(settings_schema_json_1.default.definitions.device);
const ajvRestartRequiredGroupOptions = new ajv_1.default({ allErrors: true })
    .addKeyword({ keyword: "requiresRestart", validate: (s) => !s })
    .compile(settings_schema_json_1.default.definitions.group);
exports.defaults = {
    homeassistant: {
        enabled: false,
        discovery_topic: "homeassistant",
        status_topic: "homeassistant/status",
        legacy_action_sensor: false,
        experimental_event_entities: false,
    },
    availability: {
        enabled: false,
        active: { timeout: 10, max_jitter: 30000, backoff: true, pause_on_backoff_gt: 0 },
        passive: { timeout: 1500 },
    },
    frontend: {
        enabled: false,
        package: "zigbee2mqtt-frontend",
        port: 8080,
        base_url: "/",
    },
    mqtt: {
        base_topic: "zigbee2mqtt",
        include_device_information: false,
        force_disable_retain: false,
        // 1MB = roughly 3.5KB per device * 300 devices for `/bridge/devices`
        maximum_packet_size: 1048576,
    },
    serial: {
        disable_led: false,
    },
    passlist: [],
    blocklist: [],
    map_options: {
        graphviz: {
            colors: {
                fill: {
                    enddevice: "#fff8ce",
                    coordinator: "#e04e5d",
                    router: "#4ea3e0",
                },
                font: {
                    coordinator: "#ffffff",
                    router: "#ffffff",
                    enddevice: "#000000",
                },
                line: {
                    active: "#009900",
                    inactive: "#994444",
                },
            },
        },
    },
    ota: {
        update_check_interval: 24 * 60,
        disable_automatic_update_check: false,
        image_block_response_delay: 250,
        default_maximum_data_size: 50,
    },
    device_options: {},
    advanced: {
        log_rotation: true,
        log_console_json: false,
        log_symlink_current: false,
        log_output: ["console", "file"],
        log_directory: node_path_1.default.join(data_1.default.getPath(), "log", "%TIMESTAMP%"),
        log_file: "log.log",
        log_level: /* v8 ignore next */ process.env.DEBUG ? "debug" : "info",
        log_namespaced_levels: {},
        log_syslog: {},
        log_debug_to_mqtt_frontend: false,
        log_debug_namespace_ignore: "",
        log_directories_to_keep: 10,
        pan_id: 0x1a62,
        ext_pan_id: [0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd, 0xdd],
        channel: 11,
        adapter_concurrent: undefined,
        adapter_delay: undefined,
        cache_state: true,
        cache_state_persistent: true,
        cache_state_send_on_startup: true,
        last_seen: "disable",
        elapsed: false,
        network_key: [1, 3, 5, 7, 9, 11, 13, 15, 0, 2, 4, 6, 8, 10, 12, 13],
        timestamp_format: "YYYY-MM-DD HH:mm:ss",
        output: "json",
    },
    health: {
        interval: 10,
        reset_on_check: false,
    },
};
let _settings;
let _settingsWithDefaults;
function loadSettingsWithDefaults() {
    if (!_settings) {
        _settings = read();
    }
    _settingsWithDefaults = (0, object_assign_deep_1.default)({}, exports.defaults, getPersistedSettings());
    if (!_settingsWithDefaults.devices) {
        _settingsWithDefaults.devices = {};
    }
    if (!_settingsWithDefaults.groups) {
        _settingsWithDefaults.groups = {};
    }
}
function parseValueRef(text) {
    const match = /!(.*) (.*)/g.exec(text);
    if (match) {
        let filename = match[1];
        // This is mainly for backward compatibility.
        if (!filename.endsWith(".yaml") && !filename.endsWith(".yml")) {
            filename += ".yaml";
        }
        return { filename, key: match[2] };
    }
    return null;
}
function writeMinimalDefaults() {
    const minimal = {
        version: exports.CURRENT_VERSION,
        mqtt: {
            base_topic: exports.defaults.mqtt.base_topic,
            server: "mqtt://localhost:1883",
        },
        serial: {},
        advanced: {
            log_level: exports.defaults.advanced.log_level,
            channel: exports.defaults.advanced.channel,
            network_key: "GENERATE",
            pan_id: "GENERATE",
            ext_pan_id: "GENERATE",
        },
        frontend: {
            enabled: exports.defaults.frontend.enabled,
            port: exports.defaults.frontend.port,
        },
        homeassistant: {
            enabled: exports.defaults.homeassistant.enabled,
        },
    };
    applyEnvironmentVariables(minimal);
    yaml_1.default.writeIfChanged(CONFIG_FILE_PATH, minimal);
    _settings = read();
    loadSettingsWithDefaults();
}
function setOnboarding(value) {
    const settings = getPersistedSettings();
    if (value) {
        if (!settings.onboarding) {
            settings.onboarding = value;
            write();
        }
    }
    else if (settings.onboarding) {
        delete settings.onboarding;
        write();
    }
}
function write() {
    const settings = getPersistedSettings();
    const toWrite = (0, object_assign_deep_1.default)({}, settings);
    // Read settings to check if we have to split devices/groups into separate file.
    const actual = yaml_1.default.read(CONFIG_FILE_PATH);
    // In case the setting is defined in a separate file (e.g. !secret network_key) update it there.
    for (const [ns, key] of [
        ["mqtt", "server"],
        ["mqtt", "user"],
        ["mqtt", "password"],
        ["advanced", "network_key"],
        ["frontend", "auth_token"],
    ]) {
        if (actual[ns]?.[key]) {
            const ref = parseValueRef(actual[ns][key]);
            if (ref) {
                yaml_1.default.updateIfChanged(data_1.default.joinPath(ref.filename), ref.key, toWrite[ns][key]);
                toWrite[ns][key] = actual[ns][key];
            }
        }
    }
    // Write devices/groups to separate file if required.
    const writeDevicesOrGroups = (type) => {
        if (typeof actual[type] === "string" || (Array.isArray(actual[type]) && actual[type].length > 0)) {
            const fileToWrite = Array.isArray(actual[type]) ? actual[type][0] : actual[type];
            const content = (0, object_assign_deep_1.default)({}, settings[type]);
            // If an array, only write to first file and only devices which are not in the other files.
            if (Array.isArray(actual[type])) {
                // skip i==0
                for (let i = 1; i < actual[type].length; i++) {
                    for (const key in yaml_1.default.readIfExists(data_1.default.joinPath(actual[type][i]))) {
                        delete content[key];
                    }
                }
            }
            yaml_1.default.writeIfChanged(data_1.default.joinPath(fileToWrite), content);
            toWrite[type] = actual[type];
        }
    };
    writeDevicesOrGroups("devices");
    writeDevicesOrGroups("groups");
    applyEnvironmentVariables(toWrite);
    yaml_1.default.writeIfChanged(CONFIG_FILE_PATH, toWrite);
    _settings = read();
    loadSettingsWithDefaults();
}
function validate() {
    try {
        getPersistedSettings();
    }
    catch (error) {
        if (error instanceof yaml_1.YAMLFileException) {
            return [`Your YAML file: '${error.file}' is invalid (use https://jsonformatter.org/yaml-validator to find and fix the issue)`];
        }
        return [`${error}`];
    }
    if (!ajvSetting(_settings)) {
        // biome-ignore lint/style/noNonNullAssertion: When `ajvSetting()` return false it always has `errors`
        return ajvSetting.errors.map((v) => `${v.instancePath.substring(1)} ${v.message}`);
    }
    const errors = [];
    if (_settings.advanced?.network_key && typeof _settings.advanced.network_key === "string" && _settings.advanced.network_key !== "GENERATE") {
        errors.push(`advanced.network_key: should be array or 'GENERATE' (is '${_settings.advanced.network_key}')`);
    }
    if (_settings.advanced?.pan_id && typeof _settings.advanced.pan_id === "string" && _settings.advanced.pan_id !== "GENERATE") {
        errors.push(`advanced.pan_id: should be number or 'GENERATE' (is '${_settings.advanced.pan_id}')`);
    }
    if (_settings.advanced?.ext_pan_id && typeof _settings.advanced.ext_pan_id === "string" && _settings.advanced.ext_pan_id !== "GENERATE") {
        errors.push(`advanced.ext_pan_id: should be array or 'GENERATE' (is '${_settings.advanced.ext_pan_id}')`);
    }
    // Verify that all friendly names are unique
    const names = [];
    const check = (e) => {
        if (names.includes(e.friendly_name))
            errors.push(`Duplicate friendly_name '${e.friendly_name}' found`);
        errors.push(...utils_1.default.validateFriendlyName(e.friendly_name));
        names.push(e.friendly_name);
        if ("icon" in e && e.icon && !e.icon.startsWith("http://") && !e.icon.startsWith("https://") && !e.icon.startsWith("device_icons/")) {
            errors.push(`Device icon of '${e.friendly_name}' should start with 'device_icons/', got '${e.icon}'`);
        }
        if (e.qos != null && ![0, 1, 2].includes(e.qos)) {
            errors.push(`QOS for '${e.friendly_name}' not valid, should be 0, 1 or 2 got ${e.qos}`);
        }
    };
    const settingsWithDefaults = get();
    for (const key in settingsWithDefaults.devices) {
        check(settingsWithDefaults.devices[key]);
    }
    for (const key in settingsWithDefaults.groups) {
        check(settingsWithDefaults.groups[key]);
    }
    if (settingsWithDefaults.mqtt.version !== 5) {
        for (const device of Object.values(settingsWithDefaults.devices)) {
            if (device.retention) {
                errors.push("MQTT retention requires protocol version 5");
            }
        }
    }
    return errors;
}
function read() {
    const s = yaml_1.default.read(CONFIG_FILE_PATH);
    // Read !secret MQTT username and password if set
    const interpretValue = (value) => {
        if (typeof value === "string") {
            const ref = parseValueRef(value);
            if (ref) {
                return yaml_1.default.read(data_1.default.joinPath(ref.filename))[ref.key];
            }
        }
        return value;
    };
    if (s.mqtt?.user) {
        s.mqtt.user = interpretValue(s.mqtt.user);
    }
    if (s.mqtt?.password) {
        s.mqtt.password = interpretValue(s.mqtt.password);
    }
    if (s.mqtt?.server) {
        s.mqtt.server = interpretValue(s.mqtt.server);
    }
    if (s.advanced?.network_key) {
        s.advanced.network_key = interpretValue(s.advanced.network_key);
    }
    if (s.frontend?.auth_token) {
        s.frontend.auth_token = interpretValue(s.frontend.auth_token);
    }
    // Read devices/groups configuration from separate file if specified.
    const readDevicesOrGroups = (type) => {
        if (typeof s[type] === "string" || (Array.isArray(s[type]) && Array(s[type]).length > 0)) {
            const files = Array.isArray(s[type]) ? s[type] : [s[type]];
            s[type] = {};
            for (const file of files) {
                const content = yaml_1.default.readIfExists(data_1.default.joinPath(file));
                // @ts-expect-error noMutate not typed properly
                s[type] = object_assign_deep_1.default.noMutate(s[type], content);
            }
        }
    };
    readDevicesOrGroups("devices");
    readDevicesOrGroups("groups");
    return s;
}
function applyEnvironmentVariables(settings) {
    const iterate = (obj, path) => {
        for (const key in obj) {
            if (key !== "type") {
                if (key !== "properties" && obj[key]) {
                    const type = (obj[key].type || "object").toString();
                    const envPart = path.reduce((acc, val) => `${acc}${val}_`, "");
                    const envVariableName = `ZIGBEE2MQTT_CONFIG_${envPart}${key}`.toUpperCase();
                    const envVariable = process.env[envVariableName];
                    if (envVariable) {
                        const setting = path.reduce((acc, val) => {
                            // @ts-expect-error ignore typing
                            acc[val] = acc[val] || {};
                            // @ts-expect-error ignore typing
                            return acc[val];
                        }, settings);
                        if (type.indexOf("object") >= 0 || type.indexOf("array") >= 0) {
                            try {
                                setting[key] = JSON.parse(envVariable);
                            }
                            catch {
                                // biome-ignore lint/suspicious/noExplicitAny: auto-parsing
                                setting[key] = envVariable;
                            }
                        }
                        else if (type.indexOf("number") >= 0) {
                            // biome-ignore lint/suspicious/noExplicitAny: auto-parsing
                            setting[key] = (envVariable * 1);
                        }
                        else if (type.indexOf("boolean") >= 0) {
                            // biome-ignore lint/suspicious/noExplicitAny: auto-parsing
                            setting[key] = (envVariable.toLowerCase() === "true");
                        }
                        else {
                            if (type.indexOf("string") >= 0) {
                                // biome-ignore lint/suspicious/noExplicitAny: auto-parsing
                                setting[key] = envVariable;
                            }
                        }
                    }
                }
                if (typeof obj[key] === "object" && obj[key]) {
                    const newPath = [...path];
                    if (key !== "properties" && key !== "oneOf" && !Number.isInteger(Number(key))) {
                        newPath.push(key);
                    }
                    iterate(obj[key], newPath);
                }
            }
        }
    };
    iterate(settings_schema_json_1.default.properties, []);
}
/**
 * Get the settings actually written in the yaml.
 * Env vars are applied on top.
 * Defaults merged on startup are not included.
 */
function getPersistedSettings() {
    if (!_settings) {
        _settings = read();
    }
    return _settings;
}
function get() {
    if (!_settingsWithDefaults) {
        loadSettingsWithDefaults();
    }
    // biome-ignore lint/style/noNonNullAssertion: just loaded
    return _settingsWithDefaults;
}
function set(path, value) {
    // biome-ignore lint/suspicious/noExplicitAny: auto-parsing
    let settings = getPersistedSettings();
    for (let i = 0; i < path.length; i++) {
        const key = path[i];
        if (i === path.length - 1) {
            settings[key] = value;
        }
        else {
            if (!settings[key]) {
                settings[key] = {};
            }
            settings = settings[key];
        }
    }
    write();
}
function apply(settings, throwOnError = true) {
    getPersistedSettings(); // Ensure _settings is initialized.
    // @ts-expect-error noMutate not typed properly
    const newSettings = object_assign_deep_1.default.noMutate(_settings, settings);
    utils_1.default.removeNullPropertiesFromObject(newSettings, NULLABLE_SETTINGS);
    ajvSetting(newSettings);
    if (throwOnError) {
        const errors = ajvSetting.errors?.filter((e) => e.keyword !== "required");
        if (errors?.length) {
            const error = errors[0];
            throw new Error(`${error.instancePath.substring(1)} ${error.message}`);
        }
    }
    _settings = newSettings;
    write();
    ajvRestartRequired(settings);
    const restartRequired = Boolean(ajvRestartRequired.errors && !!ajvRestartRequired.errors.find((e) => e.keyword === "requiresRestart"));
    return restartRequired;
}
function getGroup(IDorName) {
    const settings = get();
    const byID = settings.groups[IDorName];
    if (byID) {
        return { ...byID, ID: Number(IDorName) };
    }
    for (const [ID, group] of Object.entries(settings.groups)) {
        if (group.friendly_name === IDorName) {
            return { ...group, ID: Number(ID) };
        }
    }
    return undefined;
}
function getGroupThrowIfNotExists(IDorName) {
    const group = getGroup(IDorName);
    if (!group) {
        throw new Error(`Group '${IDorName}' does not exist`);
    }
    return group;
}
function getDevice(IDorName) {
    const settings = get();
    const byID = settings.devices[IDorName];
    if (byID) {
        return { ...byID, ID: IDorName };
    }
    for (const [ID, device] of Object.entries(settings.devices)) {
        if (device.friendly_name === IDorName) {
            return { ...device, ID };
        }
    }
    return undefined;
}
function getDeviceThrowIfNotExists(IDorName) {
    const device = getDevice(IDorName);
    if (!device) {
        throw new Error(`Device '${IDorName}' does not exist`);
    }
    return device;
}
function addDevice(id) {
    if (getDevice(id)) {
        throw new Error(`Device '${id}' already exists`);
    }
    const settings = getPersistedSettings();
    if (!settings.devices) {
        settings.devices = {};
    }
    settings.devices[id] = { friendly_name: id };
    write();
    // biome-ignore lint/style/noNonNullAssertion: valid from creation above
    return getDevice(id);
}
function blockDevice(id) {
    const settings = getPersistedSettings();
    if (!settings.blocklist) {
        settings.blocklist = [];
    }
    settings.blocklist.push(id);
    write();
}
function removeDevice(IDorName) {
    const device = getDeviceThrowIfNotExists(IDorName);
    const settings = getPersistedSettings();
    delete settings.devices?.[device.ID];
    write();
}
function addGroup(name, id) {
    utils_1.default.validateFriendlyName(name, true);
    if (getGroup(name) || getDevice(name)) {
        throw new Error(`friendly_name '${name}' is already in use`);
    }
    const settings = getPersistedSettings();
    if (!settings.groups) {
        settings.groups = {};
    }
    if (id == null || (typeof id === "string" && id.trim() === "")) {
        // look for free ID
        id = "1";
        while (settings.groups[id]) {
            id = (Number.parseInt(id) + 1).toString();
        }
    }
    else {
        // ensure provided ID is not in use
        id = id.toString();
        if (settings.groups[id]) {
            throw new Error(`Group ID '${id}' is already in use`);
        }
    }
    settings.groups[id] = { friendly_name: name };
    write();
    // biome-ignore lint/style/noNonNullAssertion: valid from creation above
    return getGroup(id);
}
function removeGroup(IDorName) {
    const groupID = getGroupThrowIfNotExists(IDorName.toString()).ID;
    const settings = getPersistedSettings();
    // biome-ignore lint/style/noNonNullAssertion: throwing above if not valid
    delete settings.groups[groupID];
    write();
}
function changeEntityOptions(IDorName, newOptions) {
    const settings = getPersistedSettings();
    delete newOptions.friendly_name;
    delete newOptions.devices;
    let validator;
    const device = getDevice(IDorName);
    if (device) {
        // biome-ignore lint/style/noNonNullAssertion: valid from above
        const settingsDevice = settings.devices[device.ID];
        (0, object_assign_deep_1.default)(settingsDevice, newOptions);
        utils_1.default.removeNullPropertiesFromObject(settingsDevice, NULLABLE_SETTINGS);
        validator = ajvRestartRequiredDeviceOptions;
    }
    else {
        const group = getGroup(IDorName);
        if (group) {
            // biome-ignore lint/style/noNonNullAssertion: valid from above
            const settingsGroup = settings.groups[group.ID];
            (0, object_assign_deep_1.default)(settingsGroup, newOptions);
            utils_1.default.removeNullPropertiesFromObject(settingsGroup, NULLABLE_SETTINGS);
            validator = ajvRestartRequiredGroupOptions;
        }
        else {
            throw new Error(`Device or group '${IDorName}' does not exist`);
        }
    }
    write();
    validator(newOptions);
    const restartRequired = Boolean(validator.errors && !!validator.errors.find((e) => e.keyword === "requiresRestart"));
    return restartRequired;
}
function changeFriendlyName(IDorName, newName) {
    utils_1.default.validateFriendlyName(newName, true);
    if (getGroup(newName) || getDevice(newName)) {
        throw new Error(`friendly_name '${newName}' is already in use`);
    }
    const settings = getPersistedSettings();
    const device = getDevice(IDorName);
    if (device) {
        // biome-ignore lint/style/noNonNullAssertion: valid from above
        settings.devices[device.ID].friendly_name = newName;
    }
    else {
        const group = getGroup(IDorName);
        if (group) {
            // biome-ignore lint/style/noNonNullAssertion: valid from above
            settings.groups[group.ID].friendly_name = newName;
        }
        else {
            throw new Error(`Device or group '${IDorName}' does not exist`);
        }
    }
    write();
}
function reRead() {
    _settings = undefined;
    getPersistedSettings();
    _settingsWithDefaults = undefined;
    get();
}
exports.testing = {
    write,
    clear: () => {
        _settings = undefined;
        _settingsWithDefaults = undefined;
    },
    defaults: exports.defaults,
    CURRENT_VERSION: exports.CURRENT_VERSION,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdXRpbC9zZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF5SkEsb0RBOEJDO0FBRUQsc0NBY0M7QUFFRCxzQkF1REM7QUFFRCw0QkErREM7QUFvSEQsb0RBTUM7QUFFRCxrQkFPQztBQUVELGtCQWtCQztBQUVELHNCQXlCQztBQUVELDRCQWVDO0FBWUQsOEJBZUM7QUFXRCw4QkFnQkM7QUFFRCxrQ0FRQztBQUVELG9DQUtDO0FBRUQsNEJBaUNDO0FBRUQsa0NBT0M7QUFFRCxrREFpQ0M7QUFFRCxnREF3QkM7QUFFRCx3QkFLQztBQTNyQkQsMERBQTZCO0FBRzdCLDhDQUFzQjtBQUN0Qiw0RUFBa0Q7QUFFbEQsa0RBQTBCO0FBQzFCLGtGQUFnRDtBQUl4QyxxQkFKRCw4QkFBVSxDQUlDO0FBSGxCLG9EQUE0QjtBQUM1QiwrQ0FBK0M7QUFHL0MsNkJBQTZCO0FBQzdCLHNGQUFzRjtBQUN6RSxRQUFBLGVBQWUsR0FBRyxDQUFDLENBQUM7QUFDakMsOEVBQThFO0FBQ2pFLFFBQUEsVUFBVSxHQUFzQixDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBVSxDQUFDO0FBRzVGLE1BQU0sZ0JBQWdCLEdBQUcsY0FBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBQzdELE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUM1QyxNQUFNLFVBQVUsR0FBRyxJQUFJLGFBQUcsQ0FBQyxFQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyw4QkFBVSxDQUFDLENBQUM7QUFDaEcsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLGFBQUcsQ0FBQyxFQUFDLFNBQVMsRUFBRSxJ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