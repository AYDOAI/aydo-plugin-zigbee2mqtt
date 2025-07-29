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
exports.HomeAssistant = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importStar(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
const ACTION_PATTERNS = [
    "^(?<button>(?:button_)?[a-z0-9]+)_(?<action>(?:press|hold)(?:_release)?)$",
    "^(?<action>recall|scene)_(?<scene>[0-2][0-9]{0,2})$",
    "^(?<actionPrefix>region_)(?<region>[1-9]|10)_(?<action>enter|leave|occupied|unoccupied)$",
    "^(?<action>dial_rotate)_(?<direction>left|right)_(?<speed>step|slow|fast)$",
    "^(?<action>brightness_step)(?:_(?<direction>up|down))?$",
];
const ACCESS_STATE = 0b001;
const ACCESS_SET = 0b010;
const GROUP_SUPPORTED_TYPES = ["light", "switch", "lock", "cover"];
const COVER_OPENING_LOOKUP = ["opening", "open", "forward", "up", "rising"];
const COVER_CLOSING_LOOKUP = ["closing", "close", "backward", "back", "reverse", "down", "declining"];
const COVER_STOPPED_LOOKUP = ["stopped", "stop", "pause", "paused"];
const SWITCH_DIFFERENT = ["valve_detection", "window_detection", "auto_lock", "away_mode"];
const BINARY_DISCOVERY_LOOKUP = {
    activity_led_indicator: { icon: "mdi:led-on" },
    auto_off: { icon: "mdi:flash-auto" },
    battery_low: { entity_category: "diagnostic", device_class: "battery" },
    button_lock: { entity_category: "config", icon: "mdi:lock" },
    calibration: { entity_category: "config", icon: "mdi:progress-wrench" },
    capabilities_configurable_curve: { entity_category: "diagnostic", icon: "mdi:tune" },
    capabilities_forward_phase_control: { entity_category: "diagnostic", icon: "mdi:tune" },
    capabilities_overload_detection: { entity_category: "diagnostic", icon: "mdi:tune" },
    capabilities_reactance_discriminator: { entity_category: "diagnostic", icon: "mdi:tune" },
    capabilities_reverse_phase_control: { entity_category: "diagnostic", icon: "mdi:tune" },
    carbon_monoxide: { device_class: "carbon_monoxide" },
    card: { entity_category: "config", icon: "mdi:clipboard-check" },
    child_lock: { entity_category: "config", icon: "mdi:account-lock" },
    color_sync: { entity_category: "config", icon: "mdi:sync-circle" },
    consumer_connected: { device_class: "plug" },
    contact: { device_class: "door" },
    garage_door_contact: { device_class: "garage_door", payload_on: false, payload_off: true },
    eco_mode: { entity_category: "config", icon: "mdi:leaf" },
    expose_pin: { entity_category: "config", icon: "mdi:pin" },
    flip_indicator_light: { entity_category: "config", icon: "mdi:arrow-left-right" },
    gas: { device_class: "gas" },
    indicator_mode: { entity_category: "config", icon: "mdi:led-on" },
    invert_cover: { entity_category: "config", icon: "mdi:arrow-left-right" },
    led_disabled_night: { entity_category: "config", icon: "mdi:led-off" },
    led_indication: { entity_category: "config", icon: "mdi:led-on" },
    led_enable: { entity_category: "config", icon: "mdi:led-on" },
    motor_reversal: { entity_category: "config", icon: "mdi:arrow-left-right" },
    moving: { device_class: "moving" },
    no_position_support: { entity_category: "config", icon: "mdi:minus-circle-outline" },
    noise_detected: { device_class: "sound" },
    occupancy: { device_class: "occupancy" },
    power_outage_memory: { entity_category: "config", icon: "mdi:memory" },
    presence: { device_class: "presence" },
    setup: { device_class: "running" },
    smoke: { device_class: "smoke" },
    sos: { device_class: "safety" },
    schedule: { icon: "mdi:calendar" },
    status_capacitive_load: { entity_category: "diagnostic", icon: "mdi:tune" },
    status_forward_phase_control: { entity_category: "diagnostic", icon: "mdi:tune" },
    status_inductive_load: { entity_category: "diagnostic", icon: "mdi:tune" },
    status_overload: { entity_category: "diagnostic", icon: "mdi:tune" },
    status_reverse_phase_control: { entity_category: "diagnostic", icon: "mdi:tune" },
    tamper: { device_class: "tamper" },
    temperature_scale: { entity_category: "config", icon: "mdi:temperature-celsius" },
    test: { entity_category: "diagnostic", icon: "mdi:test-tube" },
    th_heater: { icon: "mdi:heat-wave" },
    trigger_indicator: { icon: "mdi:led-on" },
    valve_alarm: { device_class: "problem" },
    valve_detection: { icon: "mdi:pipe-valve" },
    valve_state: { device_class: "opening" },
    vibration: { device_class: "vibration" },
    water_leak: { device_class: "moisture" },
    window: { device_class: "window" },
    window_detection: { icon: "mdi:window-open-variant" },
    window_open: { device_class: "window" },
};
const NUMERIC_DISCOVERY_LOOKUP = {
    ac_frequency: { device_class: "frequency", state_class: "measurement" },
    action_duration: { icon: "mdi:timer", device_class: "duration" },
    alarm_humidity_max: { device_class: "humidity", entity_category: "config", icon: "mdi:water-plus" },
    alarm_humidity_min: { device_class: "humidity", entity_category: "config", icon: "mdi:water-minus" },
    alarm_temperature_max: { device_class: "temperature", entity_category: "config", icon: "mdi:thermometer-high" },
    alarm_temperature_min: { device_class: "temperature", entity_category: "config", icon: "mdi:thermometer-low" },
    angle: { icon: "angle-acute" },
    angle_axis: { icon: "angle-acute" },
    aqi: { device_class: "aqi", state_class: "measurement" },
    auto_relock_time: { entity_category: "config", icon: "mdi:timer" },
    away_preset_days: { entity_category: "config", icon: "mdi:timer" },
    away_preset_temperature: { entity_category: "config", icon: "mdi:thermometer" },
    ballast_maximum_level: { entity_category: "config" },
    ballast_minimum_level: { entity_category: "config" },
    ballast_physical_maximum_level: { entity_category: "diagnostic" },
    ballast_physical_minimum_level: { entity_category: "diagnostic" },
    battery: { device_class: "battery", state_class: "measurement" },
    battery2: { device_class: "battery", entity_category: "diagnostic", state_class: "measurement" },
    battery_voltage: { device_class: "voltage", entity_category: "diagnostic", state_class: "measurement", enabled_by_default: true },
    boost_heating_countdown: { device_class: "duration" },
    boost_heating_countdown_time_set: { entity_category: "config", icon: "mdi:timer" },
    boost_time: { entity_category: "config", icon: "mdi:timer" },
    calibration: { entity_category: "config", icon: "mdi:wrench-clock" },
    calibration_time: { entity_category: "config", icon: "mdi:wrench-clock" },
    co2: { device_class: "carbon_dioxide", state_class: "measurement" },
    comfort_temperature: { entity_category: "config", icon: "mdi:thermometer" },
    cpu_temperature: {
        device_class: "temperature",
        entity_category: "diagnostic",
        state_class: "measurement",
    },
    cube_side: { icon: "mdi:cube" },
    current: { device_class: "current", state_class: "measurement" },
    current_phase_b: { device_class: "current", state_class: "measurement" },
    current_phase_c: { device_class: "current", state_class: "measurement" },
    deadzone_temperature: { entity_category: "config", icon: "mdi:thermometer" },
    detection_interval: { icon: "mdi:timer" },
    device_temperature: {
        device_class: "temperature",
        entity_category: "diagnostic",
        state_class: "measurement",
    },
    distance: { device_class: "distance", state_class: "measurement" },
    duration: { entity_category: "config", icon: "mdi:timer" },
    eco2: { device_class: "carbon_dioxide", state_class: "measurement" },
    eco_temperature: { entity_category: "config", icon: "mdi:thermometer" },
    energy: { device_class: "energy", state_class: "total_increasing" },
    external_temperature_input: { device_class: "temperature", icon: "mdi:thermometer" },
    external_temperature: { device_class: "temperature", icon: "mdi:thermometer" },
    external_humidity: { device_class: "humidity", icon: "mdi:water-percent" },
    formaldehyd: { state_class: "measurement" },
    flow: { device_class: "volume_flow_rate", state_class: "measurement" },
    gas_density: { icon: "mdi:google-circles-communities", state_class: "measurement" },
    hcho: { icon: "mdi:air-filter", state_class: "measurement" },
    humidity: { device_class: "humidity", state_class: "measurement" },
    humidity_calibration: { entity_category: "config", icon: "mdi:wrench-clock" },
    humidity_max: { entity_category: "config", icon: "mdi:water-percent" },
    humidity_min: { entity_category: "config", icon: "mdi:water-percent" },
    illuminance_calibration: { entity_category: "config", icon: "mdi:wrench-clock" },
    illuminance: { device_class: "illuminance", state_class: "measurement" },
    internalTemperature: {
        device_class: "temperature",
        entity_category: "diagnostic",
        state_class: "measurement",
    },
    linkquality: {
        enabled_by_default: false,
        entity_category: "diagnostic",
        icon: "mdi:signal",
        state_class: "measurement",
    },
    local_temperature: { device_class: "temperature", state_class: "measurement" },
    max_range: { entity_category: "config", icon: "mdi:signal-distance-variant" },
    max_temperature: { entity_category: "config", icon: "mdi:thermometer-high" },
    max_temperature_limit: { entity_category: "config", icon: "mdi:thermometer-high" },
    min_temperature_limit: { entity_category: "config", icon: "mdi:thermometer-low" },
    min_temperature: { entity_category: "config", icon: "mdi:thermometer-low" },
    minimum_on_level: { entity_category: "config" },
    measurement_poll_interval: { entity_category: "config", icon: "mdi:clock-out" },
    motion_sensitivity: { entity_category: "config", icon: "mdi:motion-sensor" },
    noise: { device_class: "sound_pressure", state_class: "measurement" },
    noise_detect_level: { icon: "mdi:volume-equal" },
    noise_timeout: { icon: "mdi:timer" },
    occupancy_level: { icon: "mdi:motion-sensor" },
    occupancy_sensitivity: { entity_category: "config", icon: "mdi:motion-sensor" },
    occupancy_timeout: { entity_category: "config", icon: "mdi:timer" },
    overload_protection: { icon: "mdi:flash" },
    pm10: { device_class: "pm10", state_class: "measurement" },
    pm25: { device_class: "pm25", state_class: "measurement" },
    people: { state_class: "measurement", icon: "mdi:account-multiple" },
    position: { icon: "mdi:valve", state_class: "measurement" },
    power: { device_class: "power", state_class: "measurement" },
    power_phase_b: { device_class: "power", state_class: "measurement" },
    power_phase_c: { device_class: "power", state_class: "measurement" },
    power_factor: { device_class: "power_factor", enabled_by_default: false, entity_category: "diagnostic", state_class: "measurement" },
    power_outage_count: { icon: "mdi:counter", enabled_by_default: false },
    precision: { entity_category: "config", icon: "mdi:decimal-comma-increase" },
    pressure: { device_class: "atmospheric_pressure", state_class: "measurement" },
    presence_timeout: { entity_category: "config", icon: "mdi:timer" },
    reporting_time: { entity_category: "config", icon: "mdi:clock-time-one-outline" },
    requested_brightness_level: {
        enabled_by_default: false,
        entity_category: "diagnostic",
        icon: "mdi:brightness-5",
    },
    requested_brightness_percent: {
        enabled_by_default: false,
        entity_category: "diagnostic",
        icon: "mdi:brightness-5",
    },
    smoke_density: { icon: "mdi:google-circles-communities", state_class: "measurement" },
    soil_moisture: { device_class: "moisture", state_class: "measurement" },
    temperature: { device_class: "temperature", state_class: "measurement" },
    temperature_calibration: { entity_category: "config", icon: "mdi:wrench-clock" },
    temperature_max: { entity_category: "config", icon: "mdi:thermometer-plus" },
    temperature_min: { entity_category: "config", icon: "mdi:thermometer-minus" },
    temperature_offset: { icon: "mdi:thermometer-lines" },
    transition: { entity_category: "config", icon: "mdi:transition" },
    trigger_count: { icon: "mdi:counter", enabled_by_default: false },
    voc: { device_class: "volatile_organic_compounds", state_class: "measurement" },
    voc_index: { state_class: "measurement", icon: "mdi:molecule" },
    voc_parts: { device_class: "volatile_organic_compounds_parts", state_class: "measurement" },
    vibration_timeout: { entity_category: "config", icon: "mdi:timer" },
    voltage: { device_class: "voltage", state_class: "measurement" },
    voltage_phase_b: { device_class: "voltage", state_class: "measurement" },
    voltage_phase_c: { device_class: "voltage", state_class: "measurement" },
    water_consumed: {
        device_class: "water",
        state_class: "total_increasing",
    },
    x_axis: { icon: "mdi:axis-x-arrow" },
    y_axis: { icon: "mdi:axis-y-arrow" },
    z_axis: { icon: "mdi:axis-z-arrow" },
};
const ENUM_DISCOVERY_LOOKUP = {
    action: { icon: "mdi:gesture-double-tap" },
    alarm_humidity: { entity_category: "config", icon: "mdi:water-percent-alert" },
    alarm_temperature: { entity_category: "config", icon: "mdi:thermometer-alert" },
    backlight_auto_dim: { entity_category: "config", icon: "mdi:brightness-auto" },
    backlight_mode: { entity_category: "config", icon: "mdi:lightbulb" },
    calibrate: { icon: "mdi:tune" },
    color_power_on_behavior: { entity_category: "config", icon: "mdi:palette" },
    control_mode: { entity_category: "config", icon: "mdi:tune" },
    device_mode: { entity_category: "config", icon: "mdi:tune" },
    effect: { enabled_by_default: false, icon: "mdi:palette" },
    force: { entity_category: "config", icon: "mdi:valve" },
    keep_time: { entity_category: "config", icon: "mdi:av-timer" },
    identify: { device_class: "identify" },
    keypad_lockout: { entity_category: "config", icon: "mdi:lock" },
    load_detection_mode: { entity_category: "config", icon: "mdi:tune" },
    load_dimmable: { entity_category: "config", icon: "mdi:chart-bell-curve" },
    load_type: { entity_category: "config", icon: "mdi:led-on" },
    melody: { entity_category: "config", icon: "mdi:music-note" },
    mode_phase_control: { entity_category: "config", icon: "mdi:tune" },
    mode: { entity_category: "config", icon: "mdi:tune" },
    mode_switch: { icon: "mdi:tune" },
    motion_sensitivity: { entity_category: "config", icon: "mdi:tune" },
    operation_mode: { entity_category: "config", icon: "mdi:tune" },
    power_on_behavior: { entity_category: "config", icon: "mdi:power-settings" },
    power_outage_memory: { entity_category: "config", icon: "mdi:power-settings" },
    power_supply_mode: { entity_category: "config", icon: "mdi:power-settings" },
    power_type: { entity_category: "config", icon: "mdi:lightning-bolt-circle" },
    restart: { device_class: "restart" },
    sensitivity: { entity_category: "config", icon: "mdi:tune" },
    sensor: { icon: "mdi:tune" },
    sensors_type: { entity_category: "config", icon: "mdi:tune" },
    sound_volume: { entity_category: "config", icon: "mdi:volume-high" },
    status: { icon: "mdi:state-machine" },
    switch_type: { entity_category: "config", icon: "mdi:tune" },
    temperature_display_mode: { entity_category: "config", icon: "mdi:thermometer" },
    temperature_sensor_select: { entity_category: "config", icon: "mdi:home-thermometer" },
    thermostat_unit: { entity_category: "config", icon: "mdi:thermometer" },
    update: { device_class: "update" },
    volume: { entity_category: "config", icon: "mdi: volume-high" },
    week: { entity_category: "config", icon: "mdi:calendar-clock" },
};
const LIST_DISCOVERY_LOOKUP = {
    action: { icon: "mdi:gesture-double-tap" },
    color_options: { icon: "mdi:palette" },
    level_config: { entity_category: "diagnostic" },
    programming_mode: { icon: "mdi:calendar-clock" },
    schedule_settings: { icon: "mdi:calendar-clock" },
};
const featurePropertyWithoutEndpoint = (feature) => {
    if (feature.endpoint) {
        return feature.property.slice(0, -1 + -1 * feature.endpoint.length);
    }
    return feature.property;
};
/**
 * This class handles the bridge entity configuration for Home Assistant Discovery.
 */
class Bridge {
    coordinatorIeeeAddress;
    coordinatorType;
    coordinatorFirmwareVersion;
    discoveryEntries;
    options;
    // biome-ignore lint/style/useNamingConvention: API
    get ID() {
        return this.coordinatorIeeeAddress;
    }
    get name() {
        return "bridge";
    }
    get hardwareVersion() {
        return this.coordinatorType;
    }
    get firmwareVersion() {
        return this.coordinatorFirmwareVersion;
    }
    get configs() {
        return this.discoveryEntries;
    }
    constructor(ieeeAdress, version, discovery) {
        this.coordinatorIeeeAddress = ieeeAdress;
        this.coordinatorType = version.type;
        this.coordinatorFirmwareVersion = version.meta.revision ? `${version.meta.revision}` : /* v8 ignore next */ "";
        this.discoveryEntries = discovery;
        this.options = {
            ID: `bridge_${ieeeAdress}`,
            homeassistant: {
                name: "Zigbee2MQTT Bridge",
            },
        };
    }
    isDevice() {
        return false;
    }
    isGroup() {
        return false;
    }
}
/**
 * This extensions handles integration with HomeAssistant
 */
class HomeAssistant extends extension_1.default {
    discovered = {};
    discoveryTopic;
    discoveryRegex;
    discoveryRegexWoTopic = /(.*)\/(.*)\/(.*)\/config/;
    statusTopic;
    legacyActionSensor;
    experimentalEventEntities;
    // @ts-expect-error initialized in `start`
    zigbee2MQTTVersion;
    // @ts-expect-error initialized in `start`
    discoveryOrigin;
    // @ts-expect-error initialized in `start`
    bridge;
    // @ts-expect-error initialized in `start`
    bridgeIdentifier;
    actionValueTemplate;
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension) {
        super(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension);
        if (settings.get().advanced.output === "attribute") {
            throw new Error("Home Assistant integration is not possible with attribute output!");
        }
        const haSettings = settings.get().homeassistant;
        (0, node_assert_1.default)(haSettings.enabled, `Home Assistant extension created with setting 'enabled: false'`);
        this.discoveryTopic = haSettings.discovery_topic;
        this.discoveryRegex = new RegExp(`${haSettings.discovery_topic}/(.*)/(.*)/(.*)/config`);
        this.statusTopic = haSettings.status_topic;
        this.legacyActionSensor = haSettings.legacy_action_sensor;
        this.experimentalEventEntities = haSettings.experimental_event_entities;
        if (haSettings.discovery_topic === settings.get().mqtt.base_topic) {
            throw new Error(`'homeassistant.discovery_topic' cannot not be equal to the 'mqtt.base_topic' (got '${settings.get().mqtt.base_topic}')`);
        }
        this.actionValueTemplate = this.getActionValueTemplate();
    }
    async start() {
        if (!settings.get().advanced.cache_state) {
            logger_1.default.warning("In order for Home Assistant integration to work properly set `cache_state: true");
        }
        this.zigbee2MQTTVersion = (await utils_1.default.getZigbee2MQTTVersion(false)).version;
        this.discoveryOrigin = { name: "Zigbee2MQTT", sw: this.zigbee2MQTTVersion, url: "https://www.zigbee2mqtt.io" };
        this.bridge = this.getBridgeEntity(await this.zigbee.getCoordinatorVersion());
        this.bridgeIdentifier = this.getDevicePayload(this.bridge).identifiers[0];
        this.eventBus.onEntityRemoved(this, this.onEntityRemoved);
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
        this.eventBus.onEntityRenamed(this, this.onEntityRenamed);
        this.eventBus.onPublishEntityState(this, this.onPublishEntityState);
        this.eventBus.onGroupMembersChanged(this, this.onGroupMembersChanged);
        this.eventBus.onDeviceAnnounce(this, this.onZigbeeEvent);
        this.eventBus.onDeviceJoined(this, this.onZigbeeEvent);
        this.eventBus.onDeviceInterview(this, this.onZigbeeEvent);
        this.eventBus.onDeviceMessage(this, this.onZigbeeEvent);
        this.eventBus.onScenesChanged(this, this.onScenesChanged);
        this.eventBus.onEntityOptionsChanged(this, async (data) => await this.discover(data.entity));
        this.eventBus.onExposesChanged(this, async (data) => await this.discover(data.device));
        await this.mqtt.subscribe(this.statusTopic);
        /**
         * Prevent unnecessary re-discovery of entities by waiting 5 seconds for retained discovery messages to come in.
         * Any received discovery messages will not be published again.
         * Unsubscribe from the discoveryTopic to prevent receiving our own messages.
         */
        const discoverWait = 5;
        // Discover with `published = false`, this will populate `this.discovered` without publishing the discoveries.
        // This is needed for clearing outdated entries in `this.onMQTTMessage()`
        await this.discover(this.bridge, false);
        for (const e of this.zigbee.devicesAndGroupsIterator(utils_1.default.deviceNotCoordinator)) {
            await this.discover(e, false);
        }
        logger_1.default.debug(`Discovering entities to Home Assistant in ${discoverWait}s`);
        await this.mqtt.subscribe(`${this.discoveryTopic}/#`);
        setTimeout(async () => {
            await this.mqtt.unsubscribe(`${this.discoveryTopic}/#`);
            logger_1.default.debug("Discovering entities to Home Assistant");
            await this.discover(this.bridge);
            for (const e of this.zigbee.devicesAndGroupsIterator(utils_1.default.deviceNotCoordinator)) {
                await this.discover(e);
            }
        }, utils_1.default.seconds(discoverWait));
    }
    getDiscovered(entity) {
        const ID = typeof entity === "string" || typeof entity === "number" ? entity : entity.ID;
        if (!(ID in this.discovered)) {
            this.discovered[ID] = { messages: {}, triggers: new Set(), mockProperties: new Set(), discovered: false };
        }
        return this.discovered[ID];
    }
    exposeToConfig(exposes, entityType, allExposes, definition) {
        // For groups an array of exposes (of the same type) is passed, this is to determine e.g. what features
        // to use for a bulb (e.g. color_xy/color_temp)
        (0, node_assert_1.default)(entityType === "group" || exposes.length === 1, "Multiple exposes for device not allowed");
        const firstExpose = exposes[0];
        (0, node_assert_1.default)(entityType === "device" || GROUP_SUPPORTED_TYPES.includes(firstExpose.type), `Unsupported expose type ${firstExpose.type} for group`);
        const discoveryEntries = [];
        const endpoint = entityType === "device" ? exposes[0].endpoint : undefined;
        const getProperty = (feature) => (entityType === "group" ? featurePropertyWithoutEndpoint(feature) : feature.property);
        switch (firstExpose.type) {
            case "light": {
                const hasColorXY = exposes.find((expose) => expose.features.find((e) => e.name === "color_xy"));
                const hasColorHS = exposes.find((expose) => expose.features.find((e) => e.name === "color_hs"));
                const hasBrightness = exposes.find((expose) => expose.features.find((e) => e.name === "brightness"));
                const hasColorTemp = exposes.find((expose) => expose.features.find((e) => e.name === "color_temp"));
                const state = firstExpose.features.find((f) => f.name === "state");
                (0, node_assert_1.default)(state, `Light expose must have a 'state'`);
                // Prefer HS over XY when at least one of the lights in the group prefers HS over XY.
                // A light prefers HS over XY when HS is earlier in the feature array than HS.
                const preferHS = exposes
                    .map((e) => [e.features.findIndex((ee) => ee.name === "color_xy"), e.features.findIndex((ee) => ee.name === "color_hs")])
                    .filter((d) => d[0] !== -1 && d[1] !== -1 && d[1] < d[0]).length !== 0;
                const discoveryEntry = {
                    type: "light",
                    object_id: endpoint ? `light_${endpoint}` : "light",
                    mockProperties: [{ property: state.property, value: null }],
                    discovery_payload: {
                        name: endpoint ? utils_1.default.capitalize(endpoint) : null,
                        brightness: !!hasBrightness,
                        schema: "json",
                        command_topic: true,
                        brightness_scale: 254,
                        command_topic_prefix: endpoint,
                        state_topic_postfix: endpoint,
                    },
                };
                const colorModes = [
                    hasColorXY && !preferHS ? "xy" : null,
                    (!hasColorXY || preferHS) && hasColorHS ? "hs" : null,
                    hasColorTemp ? "color_temp" : null,
                ].filter((c) => c);
                if (colorModes.length) {
                    discoveryEntry.discovery_payload.supported_color_modes = colorModes;
                }
                else {
                    /**
                     * All bulbs support brightness, note that `brightness` cannot be combined
                     * with other color modes.
                     * https://github.com/Koenkk/zigbee2mqtt/issues/26520#issuecomment-2692432058
                     */
                    discoveryEntry.discovery_payload.supported_color_modes = ["brightness"];
                }
                if (hasColorTemp) {
                    const colorTemps = exposes
                        .map((expose) => expose.features.find((e) => e.name === "color_temp"))
                        .filter((e) => e !== undefined && (0, utils_1.isNumericExpose)(e));
                    const max = Math.min(...colorTemps.map((e) => e.value_max).filter((e) => e !== undefined));
                    const min = Math.max(...colorTemps.map((e) => e.value_min).filter((e) => e !== undefined));
                    discoveryEntry.discovery_payload.max_mireds = max;
                    discoveryEntry.discovery_payload.min_mireds = min;
                }
                const effects = utils_1.default.arrayUnique(utils_1.default.flatten(allExposes
                    .filter(utils_1.isEnumExpose)
                    .filter((e) => e.name === "effect")
                    .map((e) => e.values)));
                if (effects.length) {
                    discoveryEntry.discovery_payload.effect = true;
                    discoveryEntry.discovery_payload.effect_list = effects;
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "switch": {
                const state = firstExpose.features.filter(utils_1.isBinaryExpose).find((f) => f.name === "state");
                (0, node_assert_1.default)(state, `Switch expose must have a 'state'`);
                const property = getProperty(state);
                const discoveryEntry = {
                    type: "switch",
                    object_id: endpoint ? `switch_${endpoint}` : "switch",
                    mockProperties: [{ property: property, value: null }],
                    discovery_payload: {
                        name: endpoint ? utils_1.default.capitalize(endpoint) : null,
                        payload_off: state.value_off,
                        payload_on: state.value_on,
                        value_template: `{{ value_json.${property} }}`,
                        command_topic: true,
                        command_topic_prefix: endpoint,
                    },
                };
                if (SWITCH_DIFFERENT.includes(property)) {
                    discoveryEntry.discovery_payload.name = firstExpose.label;
                    discoveryEntry.discovery_payload.command_topic_postfix = property;
                    discoveryEntry.discovery_payload.state_off = state.value_off;
                    discoveryEntry.discovery_payload.state_on = state.value_on;
                    discoveryEntry.object_id = property;
                    if (property === "window_detection") {
                        discoveryEntry.discovery_payload.icon = "mdi:window-open-variant";
                    }
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "climate": {
                const setpointProperties = ["occupied_heating_setpoint", "current_heating_setpoint"];
                const setpoint = firstExpose.features.filter(utils_1.isNumericExpose).find((f) => setpointProperties.includes(f.name));
                (0, node_assert_1.default)(setpoint && setpoint.value_min !== undefined && setpoint.value_max !== undefined, "No setpoint found or it is missing value_min/max");
                const temperature = firstExpose.features.find((f) => f.name === "local_temperature");
                (0, node_assert_1.default)(temperature, "No temperature found");
                const discoveryEntry = {
                    type: "climate",
                    object_id: endpoint ? `climate_${endpoint}` : "climate",
                    mockProperties: [],
                    discovery_payload: {
                        name: endpoint ? utils_1.default.capitalize(endpoint) : null,
                        // Static
                        state_topic: false,
                        temperature_unit: "C",
                        // Setpoint
                        temp_step: setpoint.value_step,
                        min_temp: setpoint.value_min.toString(),
                        max_temp: setpoint.value_max.toString(),
                        // Temperature
                        current_temperature_topic: true,
                        current_temperature_template: `{{ value_json.${temperature.property} }}`,
                        command_topic_prefix: endpoint,
                    },
                };
                const mode = firstExpose.features.filter(utils_1.isEnumExpose).find((f) => f.name === "system_mode");
                if (mode) {
                    if (mode.values.includes("sleep")) {
                        // 'sleep' is not supported by Home Assistant, but is valid according to ZCL
                        // TRV that support sleep (e.g. Viessmann) will have it removed from here,
                        // this allows other expose consumers to still use it, e.g. the frontend.
                        mode.values.splice(mode.values.indexOf("sleep"), 1);
                    }
                    discoveryEntry.discovery_payload.mode_state_topic = true;
                    discoveryEntry.discovery_payload.mode_state_template = `{{ value_json.${mode.property} }}`;
                    discoveryEntry.discovery_payload.modes = mode.values;
                    discoveryEntry.discovery_payload.mode_command_topic = true;
                }
                const state = firstExpose.features.find((f) => f.name === "running_state");
                if (state) {
                    discoveryEntry.mockProperties.push({ property: state.property, value: null });
                    discoveryEntry.discovery_payload.action_topic = true;
                    discoveryEntry.discovery_payload.action_template = `{% set values = {None:None,'idle':'idle','heat':'heating','cool':'cooling','fan_only':'fan'} %}{{ values[value_json.${state.property}] }}`;
                }
                const coolingSetpoint = firstExpose.features.find((f) => f.name === "occupied_cooling_setpoint");
                if (coolingSetpoint) {
                    discoveryEntry.discovery_payload.temperature_low_command_topic = setpoint.name;
                    discoveryEntry.discovery_payload.temperature_low_state_template = `{{ value_json.${setpoint.property} }}`;
                    discoveryEntry.discovery_payload.temperature_low_state_topic = true;
                    discoveryEntry.discovery_payload.temperature_high_command_topic = coolingSetpoint.name;
                    discoveryEntry.discovery_payload.temperature_high_state_template = `{{ value_json.${coolingSetpoint.property} }}`;
                    discoveryEntry.discovery_payload.temperature_high_state_topic = true;
                }
                else {
                    discoveryEntry.discovery_payload.temperature_command_topic = setpoint.name;
                    discoveryEntry.discovery_payload.temperature_state_template = `{{ value_json.${setpoint.property} }}`;
                    discoveryEntry.discovery_payload.temperature_state_topic = true;
                }
                const fanMode = firstExpose.features.filter(utils_1.isEnumExpose).find((f) => f.name === "fan_mode");
                if (fanMode) {
                    discoveryEntry.discovery_payload.fan_modes = fanMode.values;
                    discoveryEntry.discovery_payload.fan_mode_command_topic = true;
                    discoveryEntry.discovery_payload.fan_mode_state_template = `{{ value_json.${fanMode.property} }}`;
                    discoveryEntry.discovery_payload.fan_mode_state_topic = true;
                }
                const swingMode = firstExpose.features.filter(utils_1.isEnumExpose).find((f) => f.name === "swing_mode");
                if (swingMode) {
                    discoveryEntry.discovery_payload.swing_modes = swingMode.values;
                    discoveryEntry.discovery_payload.swing_mode_command_topic = true;
                    discoveryEntry.discovery_payload.swing_mode_state_template = `{{ value_json.${swingMode.property} }}`;
                    discoveryEntry.discovery_payload.swing_mode_state_topic = true;
                }
                const preset = firstExpose.features.filter(utils_1.isEnumExpose).find((f) => f.name === "preset");
                if (preset) {
                    discoveryEntry.discovery_payload.preset_modes = preset.values;
                    discoveryEntry.discovery_payload.preset_mode_command_topic = "preset";
                    discoveryEntry.discovery_payload.preset_mode_value_template = `{{ value_json.${preset.property} }}`;
                    discoveryEntry.discovery_payload.preset_mode_state_topic = true;
                }
                const tempCalibration = firstExpose.features
                    .filter(utils_1.isNumericExpose)
                    .find((f) => f.name === "local_temperature_calibration");
                if (tempCalibration) {
                    const discoveryEntry = {
                        type: "number",
                        object_id: endpoint ? `${tempCalibration.name}_${endpoint}` : `${tempCalibration.name}`,
                        mockProperties: [{ property: tempCalibration.property, value: null }],
                        discovery_payload: {
                            name: endpoint ? `${tempCalibration.label} ${endpoint}` : tempCalibration.label,
                            value_template: `{{ value_json.${tempCalibration.property} }}`,
                            command_topic: true,
                            command_topic_prefix: endpoint,
                            command_topic_postfix: tempCalibration.property,
                            device_class: "temperature",
                            entity_category: "config",
                            icon: "mdi:math-compass",
                            ...(tempCalibration.unit && { unit_of_measurement: tempCalibration.unit }),
                        },
                    };
                    if (tempCalibration.value_min != null)
                        discoveryEntry.discovery_payload.min = tempCalibration.value_min;
                    if (tempCalibration.value_max != null)
                        discoveryEntry.discovery_payload.max = tempCalibration.value_max;
                    if (tempCalibration.value_step != null) {
                        discoveryEntry.discovery_payload.step = tempCalibration.value_step;
                    }
                    discoveryEntries.push(discoveryEntry);
                }
                const piHeatingDemand = firstExpose.features.filter(utils_1.isNumericExpose).find((f) => f.name === "pi_heating_demand");
                if (piHeatingDemand) {
                    const discoveryEntry = {
                        type: "sensor",
                        object_id: endpoint ? /* v8 ignore next */ `${piHeatingDemand.name}_${endpoint}` : `${piHeatingDemand.name}`,
                        mockProperties: [{ property: piHeatingDemand.property, value: null }],
                        discovery_payload: {
                            name: endpoint ? /* v8 ignore next */ `${piHeatingDemand.label} ${endpoint}` : piHeatingDemand.label,
                            value_template: `{{ value_json.${piHeatingDemand.property} }}`,
                            ...(piHeatingDemand.unit && { unit_of_measurement: piHeatingDemand.unit }),
                            entity_category: "diagnostic",
                            icon: "mdi:radiator",
                        },
                    };
                    discoveryEntries.push(discoveryEntry);
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "lock": {
                const state = firstExpose.features.filter(utils_1.isBinaryExpose).find((f) => f.name === "state");
                (0, node_assert_1.default)(state?.name === "state", "Lock expose must have a 'state'");
                const discoveryEntry = {
                    type: "lock",
                    /* v8 ignore next */
                    object_id: endpoint ? `lock_${endpoint}` : "lock",
                    mockProperties: [{ property: state.property, value: null }],
                    discovery_payload: {
                        /* v8 ignore next */
                        name: endpoint ? utils_1.default.capitalize(endpoint) : null,
                        command_topic_prefix: endpoint,
                        command_topic: true,
                        value_template: `{{ value_json.${state.property} }}`,
                        state_locked: state.value_on,
                        state_unlocked: state.value_off,
                        /* v8 ignore next */
                        command_topic_postfix: endpoint ? state.property : null,
                    },
                };
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "cover": {
                const state = exposes
                    .find((expose) => expose.features.find((e) => e.name === "state"))
                    ?.features.find((f) => f.name === "state");
                (0, node_assert_1.default)(state, `Cover expose must have a 'state'`);
                const position = exposes
                    .find((expose) => expose.features.find((e) => e.name === "position"))
                    ?.features.find((f) => f.name === "position");
                const tilt = exposes
                    .find((expose) => expose.features.find((e) => e.name === "tilt"))
                    ?.features.find((f) => f.name === "tilt");
                const motorState = allExposes
                    ?.filter(utils_1.isEnumExpose)
                    .find((e) => ["motor_state", "moving"].includes(e.name) && e.access === ACCESS_STATE);
                const running = allExposes?.filter(utils_1.isBinaryExpose)?.find((e) => e.name === "running");
                const discoveryEntry = {
                    type: "cover",
                    mockProperties: [{ property: state.property, value: null }],
                    object_id: endpoint ? `cover_${endpoint}` : "cover",
                    discovery_payload: {
                        name: endpoint ? utils_1.default.capitalize(endpoint) : null,
                        command_topic_prefix: endpoint,
                        command_topic: true,
                        state_topic: true,
                        state_topic_postfix: endpoint,
                    },
                };
                // If curtains have `running` property, use this in discovery.
                // The movement direction is calculated (assumed) in this case.
                if (running) {
                    (0, node_assert_1.default)(position, `Cover must have 'position' when it has 'running'`);
                    discoveryEntry.discovery_payload.value_template = `{% if "${featurePropertyWithoutEndpoint(running)}" in value_json and value_json.${featurePropertyWithoutEndpoint(running)} %} {% if value_json.${featurePropertyWithoutEndpoint(position)} > 0 %} closing {% else %} opening {% endif %} {% else %} stopped {% endif %}`;
                }
                // If curtains have `motor_state` or `moving` property, lookup for possible
                // state names to detect movement direction and use this in discovery.
                if (motorState) {
                    const openingState = motorState.values.find((s) => COVER_OPENING_LOOKUP.includes(s.toString().toLowerCase()));
                    const closingState = motorState.values.find((s) => COVER_CLOSING_LOOKUP.includes(s.toString().toLowerCase()));
                    const stoppedState = motorState.values.find((s) => COVER_STOPPED_LOOKUP.includes(s.toString().toLowerCase()));
                    if (openingState && closingState && stoppedState) {
                        discoveryEntry.discovery_payload.state_opening = openingState;
                        discoveryEntry.discovery_payload.state_closing = closingState;
                        discoveryEntry.discovery_payload.state_stopped = stoppedState;
                        discoveryEntry.discovery_payload.value_template = `{% if "${featurePropertyWithoutEndpoint(motorState)}" in value_json and value_json.${featurePropertyWithoutEndpoint(motorState)} %} {{ value_json.${featurePropertyWithoutEndpoint(motorState)} }} {% else %} ${stoppedState} {% endif %}`;
                    }
                }
                // If curtains do not have `running`, `motor_state` or `moving` properties.
                if (!discoveryEntry.discovery_payload.value_template) {
                    discoveryEntry.discovery_payload.value_template = `{{ value_json.${featurePropertyWithoutEndpoint(state)} }}`;
                    discoveryEntry.discovery_payload.state_open = "OPEN";
                    discoveryEntry.discovery_payload.state_closed = "CLOSE";
                    discoveryEntry.discovery_payload.state_stopped = "STOP";
                }
                /* v8 ignore start */
                if (!position && !tilt) {
                    discoveryEntry.discovery_payload.optimistic = true;
                }
                /* v8 ignore stop */
                if (position) {
                    discoveryEntry.discovery_payload = {
                        ...discoveryEntry.discovery_payload,
                        position_template: `{{ value_json.${featurePropertyWithoutEndpoint(position)} }}`,
                        set_position_template: `{ "${getProperty(position)}": {{ position }} }`,
                        set_position_topic: true,
                        position_topic: true,
                    };
                }
                if (tilt) {
                    discoveryEntry.discovery_payload = {
                        ...discoveryEntry.discovery_payload,
                        tilt_command_topic: true,
                        tilt_status_topic: true,
                        tilt_status_template: `{{ value_json.${featurePropertyWithoutEndpoint(tilt)} }}`,
                    };
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "fan": {
                (0, node_assert_1.default)(!endpoint, "Endpoint not supported for fan type");
                const discoveryEntry = {
                    type: "fan",
                    object_id: "fan",
                    mockProperties: [{ property: "fan_state", value: null }],
                    discovery_payload: {
                        name: null,
                        state_topic: true,
                        command_topic: true,
                    },
                };
                const modeEmulatedSpeed = firstExpose.features.filter(utils_1.isEnumExpose).find((e) => e.name === "mode");
                const nativeSpeed = firstExpose.features.filter(utils_1.isNumericExpose).find((e) => e.name === "speed");
                // Exactly one mode needs to be active (logical xor)
                (0, node_assert_1.default)(!modeEmulatedSpeed !== !nativeSpeed, "Fans need to be either mode- or speed-controlled");
                if (modeEmulatedSpeed) {
                    // A fan entity in Home Assistant 2021.3 and above may have a speed,
                    // controlled by a percentage from 1 to 100, and/or non-speed presets.
                    // The MQTT Fan integration allows the speed percentage to be mapped
                    // to a narrower range of speeds (e.g. 1-3), and for these speeds to be
                    // translated to and from MQTT messages via templates.
                    //
                    // For the fixed fan modes in ZCL hvacFanCtrl, we model speeds "low",
                    // "medium", and "high" as three speeds covering the full percentage
                    // range as done in Home Assistant's zigpy fan integration, plus
                    // presets "on", "auto" and "smart" to cover the remaining modes in
                    // ZCL. This supports a generic ZCL HVAC Fan Control fan. "Off" is
                    // always a valid speed.
                    let speeds = ["off"].concat(["low", "medium", "high", "1", "2", "3", "4", "5", "6", "7", "8", "9"].filter((s) => modeEmulatedSpeed.values.includes(s)));
                    let presets = ["on", "auto", "smart"].filter((s) => modeEmulatedSpeed.values.includes(s));
                    if (definition?.model === "99432") {
                        // The Hampton Bay 99432 fan implements 4 speeds using the ZCL
                        // hvacFanCtrl values `low`, `medium`, `high`, and `on`, and
                        // 1 preset called "Comfort Breeze" using the ZCL value `smart`.
                        // ZCL value `auto` is unused.
                        speeds = ["off", "low", "medium", "high", "on"];
                        presets = ["smart"];
                    }
                    const allowed = [...speeds, ...presets];
                    for (const val of modeEmulatedSpeed.values) {
                        (0, node_assert_1.default)(allowed.includes(val.toString()));
                    }
                    const percentValues = speeds.map((s, i) => `'${s}':${i}`).join(", ");
                    const percentCommands = speeds.map((s, i) => `${i}:'${s}'`).join(", ");
                    const presetList = presets.map((s) => `'${s}'`).join(", ");
                    discoveryEntry.discovery_payload.percentage_state_topic = true;
                    discoveryEntry.discovery_payload.percentage_command_topic = "fan_mode";
                    discoveryEntry.discovery_payload.percentage_value_template = `{{ {${percentValues}}[value_json.${modeEmulatedSpeed.property}] | default('None') }}`;
                    discoveryEntry.discovery_payload.percentage_command_template = `{{ {${percentCommands}}[value] | default('') }}`;
                    discoveryEntry.discovery_payload.speed_range_min = 1;
                    discoveryEntry.discovery_payload.speed_range_max = speeds.length - 1;
                    (0, node_assert_1.default)(presets.length !== 0);
                    discoveryEntry.discovery_payload.preset_mode_state_topic = true;
                    discoveryEntry.discovery_payload.preset_mode_command_topic = "fan_mode";
                    discoveryEntry.discovery_payload.preset_mode_value_template = `{{ value_json.${modeEmulatedSpeed.property} if value_json.${modeEmulatedSpeed.property} in [${presetList}] else 'None' | default('None') }}`;
                    discoveryEntry.discovery_payload.preset_modes = presets;
                    // Emulate state based on mode
                    discoveryEntry.discovery_payload.state_value_template = "{{ value_json.fan_state }}";
                    discoveryEntry.discovery_payload.command_topic_postfix = "fan_state";
                }
                else if (nativeSpeed) {
                    discoveryEntry.discovery_payload.percentage_state_topic = true;
                    discoveryEntry.discovery_payload.percentage_command_topic = "speed";
                    discoveryEntry.discovery_payload.percentage_value_template = `{{ value_json.${nativeSpeed.property} | default('None') }}`;
                    discoveryEntry.discovery_payload.percentage_command_template = `{{ value | default('') }}`;
                    discoveryEntry.discovery_payload.speed_range_min = nativeSpeed.value_min;
                    discoveryEntry.discovery_payload.speed_range_max = nativeSpeed.value_max;
                    // Speed-controlled fans generally have an onOff cluster, use that for state
                    discoveryEntry.discovery_payload.state_value_template = "{{ value_json.state }}";
                    discoveryEntry.discovery_payload.command_topic_postfix = "state";
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "binary": {
                /**
                 * If Z2M binary attribute has SET access then expose it as `switch` in HA
                 * There is also a check on the values for typeof boolean to prevent invalid values and commands
                 * silently failing - commands work fine but some devices won't reject unexpected values.
                 * https://github.com/Koenkk/zigbee2mqtt/issues/7740
                 */
                (0, utils_1.assertBinaryExpose)(firstExpose);
                if (firstExpose.access & ACCESS_SET) {
                    const discoveryEntry = {
                        type: "switch",
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        object_id: endpoint ? `switch_${firstExpose.name}_${endpoint}` : `switch_${firstExpose.name}`,
                        discovery_payload: {
                            name: endpoint ? /* v8 ignore next */ `${firstExpose.label} ${endpoint}` : firstExpose.label,
                            value_template: typeof firstExpose.value_on === "boolean"
                                ? `{% if value_json.${firstExpose.property} %}true{% else %}false{% endif %}`
                                : `{{ value_json.${firstExpose.property} }}`,
                            payload_on: firstExpose.value_on.toString(),
                            payload_off: firstExpose.value_off.toString(),
                            command_topic: true,
                            command_topic_prefix: endpoint,
                            command_topic_postfix: firstExpose.property,
                            ...(BINARY_DISCOVERY_LOOKUP[firstExpose.name] || {}),
                        },
                    };
                    discoveryEntries.push(discoveryEntry);
                }
                else {
                    const discoveryEntry = {
                        type: "binary_sensor",
                        object_id: endpoint ? `${firstExpose.name}_${endpoint}` : `${firstExpose.name}`,
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        discovery_payload: {
                            name: endpoint ? /* v8 ignore next */ `${firstExpose.label} ${endpoint}` : firstExpose.label,
                            value_template: `{{ value_json.${firstExpose.property} }}`,
                            payload_on: firstExpose.value_on,
                            payload_off: firstExpose.value_off,
                            ...(BINARY_DISCOVERY_LOOKUP[firstExpose.name] || {}),
                        },
                    };
                    discoveryEntries.push(discoveryEntry);
                }
                break;
            }
            case "numeric": {
                (0, utils_1.assertNumericExpose)(firstExpose);
                const allowsSet = firstExpose.access & ACCESS_SET;
                /**
                 * If numeric attribute has SET access then expose as SELECT entity.
                 */
                if (allowsSet) {
                    const discoveryEntry = {
                        type: "number",
                        object_id: endpoint ? `${firstExpose.name}_${endpoint}` : `${firstExpose.name}`,
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        discovery_payload: {
                            name: endpoint ? `${firstExpose.label} ${endpoint}` : firstExpose.label,
                            value_template: `{{ value_json.${firstExpose.property} }}`,
                            command_topic: true,
                            command_topic_prefix: endpoint,
                            command_topic_postfix: firstExpose.property,
                            ...(firstExpose.unit && { unit_of_measurement: firstExpose.unit }),
                            ...(firstExpose.value_step && { step: firstExpose.value_step }),
                            ...NUMERIC_DISCOVERY_LOOKUP[firstExpose.name],
                        },
                    };
                    if (NUMERIC_DISCOVERY_LOOKUP[firstExpose.name]?.device_class === "temperature") {
                        discoveryEntry.discovery_payload.device_class = NUMERIC_DISCOVERY_LOOKUP[firstExpose.name]?.device_class;
                    }
                    else {
                        delete discoveryEntry.discovery_payload.device_class;
                    }
                    if (firstExpose.value_min != null)
                        discoveryEntry.discovery_payload.min = firstExpose.value_min;
                    if (firstExpose.value_max != null)
                        discoveryEntry.discovery_payload.max = firstExpose.value_max;
                    discoveryEntries.push(discoveryEntry);
                    break;
                }
                const extraAttrs = {};
                // If a variable includes Wh, mark it as energy
                if (firstExpose.unit && ["Wh", "kWh"].includes(firstExpose.unit)) {
                    Object.assign(extraAttrs, { device_class: "energy", state_class: "total_increasing" });
                }
                // If a variable includes A or mA, mark it as current
                else if (firstExpose.unit && ["A", "mA"].includes(firstExpose.unit)) {
                    Object.assign(extraAttrs, { device_class: "current", state_class: "measurement" });
                }
                // If a variable includes mW, W, kW mark it as power
                else if (firstExpose.unit && ["mW", "W", "kW"].includes(firstExpose.unit)) {
                    Object.assign(extraAttrs, { device_class: "power", state_class: "measurement" });
                }
                let key = firstExpose.name;
                // Home Assistant uses a different voc device_class for µg/m³ versus ppb or ppm.
                if (firstExpose.name === "voc" && firstExpose.unit && ["ppb", "ppm"].includes(firstExpose.unit)) {
                    key = "voc_parts";
                }
                const discoveryEntry = {
                    type: "sensor",
                    object_id: endpoint ? `${firstExpose.name}_${endpoint}` : `${firstExpose.name}`,
                    mockProperties: [{ property: firstExpose.property, value: null }],
                    discovery_payload: {
                        name: endpoint ? `${firstExpose.label} ${endpoint}` : firstExpose.label,
                        value_template: `{{ value_json.${firstExpose.property} }}`,
                        enabled_by_default: !allowsSet,
                        ...(firstExpose.unit && { unit_of_measurement: firstExpose.unit }),
                        ...NUMERIC_DISCOVERY_LOOKUP[key],
                        ...extraAttrs,
                    },
                };
                // When a device_class is set, unit_of_measurement must be set, otherwise warnings are generated.
                // https://github.com/Koenkk/zigbee2mqtt/issues/15958#issuecomment-1377483202
                if (discoveryEntry.discovery_payload.device_class && !discoveryEntry.discovery_payload.unit_of_measurement) {
                    delete discoveryEntry.discovery_payload.device_class;
                }
                // entity_category config is not allowed for sensors
                // https://github.com/Koenkk/zigbee2mqtt/issues/20252
                if (discoveryEntry.discovery_payload.entity_category === "config") {
                    discoveryEntry.discovery_payload.entity_category = "diagnostic";
                }
                discoveryEntries.push(discoveryEntry);
                break;
            }
            case "enum": {
                (0, utils_1.assertEnumExpose)(firstExpose);
                /**
                 * If enum attribute does not have SET access and is named 'action', then expose
                 * as EVENT entity. Wildcard actions like `recall_*` are currently not supported.
                 */
                if (firstExpose.property === "action") {
                    if (this.experimentalEventEntities &&
                        firstExpose.access & ACCESS_STATE &&
                        !(firstExpose.access & ACCESS_SET) &&
                        firstExpose.property === "action") {
                        discoveryEntries.push({
                            type: "event",
                            object_id: firstExpose.property,
                            mockProperties: [],
                            discovery_payload: {
                                name: endpoint ? /* v8 ignore next */ `${firstExpose.label} ${endpoint}` : firstExpose.label,
                                state_topic: true,
                                event_types: this.prepareActionEventTypes(firstExpose.values),
                                value_template: this.actionValueTemplate,
                                ...ENUM_DISCOVERY_LOOKUP[firstExpose.name],
                            },
                        });
                    }
                    if (!this.legacyActionSensor) {
                        break;
                    }
                }
                const valueTemplate = firstExpose.access & ACCESS_STATE ? `{{ value_json.${firstExpose.property} }}` : undefined;
                /**
                 * If enum has only one item and has SET access then expose as BUTTON entity.
                 */
                if (firstExpose.access & ACCESS_SET && firstExpose.values.length === 1) {
                    discoveryEntries.push({
                        type: "button",
                        object_id: firstExpose.property,
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        discovery_payload: {
                            name: endpoint ? /* v8 ignore next */ `${firstExpose.label} ${endpoint}` : firstExpose.label,
                            state_topic: false,
                            command_topic_prefix: endpoint,
                            command_topic: true,
                            command_topic_postfix: firstExpose.property,
                            payload_press: firstExpose.values[0].toString(),
                            ...ENUM_DISCOVERY_LOOKUP[firstExpose.name],
                        },
                    });
                    break;
                }
                /**
                 * If enum attribute has SET access then expose as SELECT entity.
                 */
                if (firstExpose.access & ACCESS_SET) {
                    discoveryEntries.push({
                        type: "select",
                        object_id: firstExpose.property,
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        discovery_payload: {
                            name: endpoint ? `${firstExpose.label} ${endpoint}` : firstExpose.label,
                            value_template: valueTemplate,
                            state_topic: !!(firstExpose.access & ACCESS_STATE),
                            command_topic_prefix: endpoint,
                            command_topic: true,
                            command_topic_postfix: firstExpose.property,
                            options: firstExpose.values.map((v) => v.toString()),
                            ...ENUM_DISCOVERY_LOOKUP[firstExpose.name],
                        },
                    });
                    break;
                }
                /**
                 * Otherwise expose as SENSOR entity.
                 */
                if (firstExpose.access & ACCESS_STATE) {
                    discoveryEntries.push({
                        type: "sensor",
                        object_id: firstExpose.property,
                        mockProperties: [{ property: firstExpose.property, value: null }],
                        discovery_payload: {
                            name: endpoint ? `${firstExpose.label} ${endpoint}` : firstExpose.label,
                            value_template: valueTemplate,
                            ...ENUM_DISCOVERY_LOOKUP[firstExpose.name],
                        },
                    });
                }
                break;
            }
            case "text":
            case "composite":
            case "list": {
                const firstExposeTyped = firstExpose;
                if (firstExposeTyped.type === "text" && firstExposeTyped.access & ACCESS_SET) {
                    discoveryEntries.push({
                        type: "text",
                        object_id: firstExposeTyped.property,
                        mockProperties: [{ property: firstExposeTyped.property, value: null }],
                        discovery_payload: {
                            name: endpoint ? `${firstExposeTyped.label} ${endpoint}` : firstExposeTyped.label,
                            state_topic: firstExposeTyped.access & ACCESS_STATE,
                            value_template: `{{ value_json.${firstExposeTyped.property} }}`,
                            command_topic_prefix: endpoint,
                            command_topic: true,
                            command_topic_postfix: firstExposeTyped.property,
                            ...LIST_DISCOVERY_LOOKUP[firstExposeTyped.name],
                        },
                    });
                    break;
                }
                if (firstExposeTyped.access & ACCESS_STATE) {
                    discoveryEntries.push({
                        type: "sensor",
                        object_id: firstExposeTyped.property,
                        mockProperties: [{ property: firstExposeTyped.property, value: null }],
                        discovery_payload: {
                            name: endpoint ? `${firstExposeTyped.label} ${endpoint}` : firstExposeTyped.label,
                            // Truncate text if it's too long
                            // https://github.com/Koenkk/zigbee2mqtt/issues/23199
                            value_template: `{{ value_json.${firstExposeTyped.property} | default('',True) | string | truncate(254, True, '', 0) }}`,
                            ...LIST_DISCOVERY_LOOKUP[firstExposeTyped.name],
                        },
                    });
                }
                break;
            }
        }
        // Exposes with category 'config' or 'diagnostic' are always added to the respective category.
        // This takes precedence over definitions in this file.
        if (firstExpose.category === "config" || firstExpose.category === "diagnostic") {
            for (const entry of discoveryEntries) {
                entry.discovery_payload.entity_category = firstExpose.category;
            }
        }
        for (const entry of discoveryEntries) {
            // If a sensor has entity category `config`, then change
            // it to `diagnostic`. Sensors have no input, so can't be configured.
            // https://github.com/Koenkk/zigbee2mqtt/pull/19474
            if (["binary_sensor", "sensor"].includes(entry.type) && entry.discovery_payload.entity_category === "config") {
                entry.discovery_payload.entity_category = "diagnostic";
            }
            // Event entities cannot have an entity_category set.
            if (entry.type === "event" && entry.discovery_payload.entity_category) {
                delete entry.discovery_payload.entity_category;
            }
            // Let Home Assistant generate entity name when device_class is present
            if (entry.discovery_payload.device_class) {
                delete entry.discovery_payload.name;
            }
        }
        return discoveryEntries;
    }
    async onEntityRemoved(data) {
        logger_1.default.debug(`Clearing Home Assistant discovery for '${data.name}'`);
        const discovered = this.getDiscovered(data.id);
        for (const topic of Object.keys(discovered.messages)) {
            await this.mqtt.publish(topic, "", { clientOptions: { retain: true, qos: 1 }, baseTopic: this.discoveryTopic, skipReceive: false });
        }
        delete this.discovered[data.id];
    }
    async onGroupMembersChanged(data) {
        await this.discover(data.group);
    }
    async onPublishEntityState(data) {
        /**
         * In case we deal with a lightEndpoint configuration Zigbee2MQTT publishes
         * e.g. {state_l1: ON, brightness_l1: 250} to zigbee2mqtt/mydevice.
         * As the Home Assistant MQTT JSON light cannot be configured to use state_l1/brightness_l1
         * as the state variables, the state topic is set to zigbee2mqtt/mydevice/l1.
         * Here we retrieve all the attributes with the _l1 values and republish them on
         * zigbee2mqtt/mydevice/l1.
         */
        // biome-ignore lint/style/noNonNullAssertion: TODO: biome migration: should this be validated instead?
        const entity = this.zigbee.resolveEntity(data.entity.name);
        if (entity.isDevice()) {
            for (const topic in this.getDiscovered(entity).messages) {
                const topicMatch = topic.match(this.discoveryRegexWoTopic);
                /* v8 ignore start */
                if (!topicMatch) {
                    continue;
                }
                /* v8 ignore stop */
                const objectID = topicMatch[3];
                const lightMatch = /^light_(.*)/.exec(objectID);
                const coverMatch = /^cover_(.*)/.exec(objectID);
                const match = lightMatch || coverMatch;
                if (match) {
                    const endpoint = match[1];
                    const endpointRegExp = new RegExp(`(.*)_${endpoint}`);
                    const payload = {};
                    for (const key of Object.keys(data.message)) {
                        const keyMatch = endpointRegExp.exec(key);
                        if (keyMatch) {
                            payload[keyMatch[1]] = data.message[key];
                        }
                    }
                    await this.mqtt.publish(`${data.entity.name}/${endpoint}`, (0, json_stable_stringify_without_jsonify_1.default)(payload), {});
                }
            }
        }
        /**
         * Publish an empty value for click and action payload, in this way Home Assistant
         * can use Home Assistant entities in automations.
         * https://github.com/Koenkk/zigbee2mqtt/issues/959#issuecomment-480341347
         */
        if (this.legacyActionSensor && data.message.action) {
            await this.publishEntityState(data.entity, { action: "" });
        }
        /**
         * Implements the MQTT device trigger (https://www.home-assistant.io/integrations/device_trigger.mqtt/)
         * The MQTT device trigger does not support JSON parsing, so it cannot listen to zigbee2mqtt/my_device
         * Whenever a device publish an {action: *} we discover an MQTT device trigger sensor
         * and republish it to zigbee2mqtt/my_device/action
         */
        if (settings.get().advanced.output === "json" && entity.isDevice() && entity.definition && data.message.action) {
            const value = data.message.action.toString();
            await this.publishDeviceTriggerDiscover(entity, "action", value);
            await this.mqtt.publish(`${data.entity.name}/action`, value, {});
        }
    }
    async onEntityRenamed(data) {
        logger_1.default.debug(`Refreshing Home Assistant discovery topic for '${data.entity.name}'`);
        // Clear before rename so Home Assistant uses new friendly_name
        // https://github.com/Koenkk/zigbee2mqtt/issues/4096#issuecomment-674044916
        if (data.homeAssisantRename) {
            const discovered = this.getDiscovered(data.entity);
            for (const topic of Object.keys(discovered.messages)) {
                await this.mqtt.publish(topic, "", { clientOptions: { retain: true, qos: 1 }, baseTopic: this.discoveryTopic, skipReceive: false });
            }
            discovered.messages = {};
            // Make sure Home Assistant deletes the old entity first otherwise another one (_2) is created
            // https://github.com/Koenkk/zigbee2mqtt/issues/12610
            await utils_1.default.sleep(2);
        }
        await this.discover(data.entity);
        if (data.entity.isDevice()) {
            for (const config of this.getDiscovered(data.entity).triggers) {
                const key = config.substring(0, config.indexOf("_"));
                const value = config.substring(config.indexOf("_") + 1);
                await this.publishDeviceTriggerDiscover(data.entity, key, value, true);
            }
        }
    }
    getConfigs(entity) {
        const isDevice = entity.isDevice();
        const isGroup = entity.isGroup();
        /* v8 ignore next */
        if (!entity || (isDevice && !entity.definition))
            return [];
        let configs = [];
        if (isDevice) {
            const exposes = entity.exposes(); // avoid calling it hundred of times/s
            for (const expose of exposes) {
                configs.push(...this.exposeToConfig([expose], "device", exposes, entity.definition));
            }
        }
        else if (isGroup) {
            // group
            const exposesByType = {};
            const allExposes = [];
            for (const member of entity.zh.members) {
                const device = this.zigbee.resolveEntity(member.getDevice());
                if (device.definition) {
                    const exposes = device.exposes();
                    allExposes.push(...exposes);
                    for (const expose of exposes.filter((e) => GROUP_SUPPORTED_TYPES.includes(e.type))) {
                        let key = expose.type;
                        if (["switch", "lock", "cover"].includes(expose.type) && expose.endpoint) {
                            // A device can have multiple of these types which have to discovered separately.
                            // e.g. switch with property state and valve_detection.
                            const state = expose.features.find((f) => f.name === "state");
                            (0, node_assert_1.default)(state, `'switch', 'lock' or 'cover' is missing state`);
                            key += featurePropertyWithoutEndpoint(state);
                        }
                        if (!exposesByType[key])
                            exposesByType[key] = [];
                        exposesByType[key].push(expose);
                    }
                }
            }
            configs = [].concat(...Object.values(exposesByType).map((exposes) => this.exposeToConfig(exposes, "group", allExposes)));
        }
        else {
            // Discover bridge config.
            configs.push(...entity.configs);
        }
        if (isDevice && settings.get().advanced.last_seen !== "disable") {
            const config = {
                type: "sensor",
                object_id: "last_seen",
                mockProperties: [{ property: "last_seen", value: null }],
                discovery_payload: {
                    name: "Last seen",
                    value_template: "{{ value_json.last_seen }}",
                    icon: "mdi:clock",
                    enabled_by_default: false,
                    entity_category: "diagnostic",
                },
            };
            if (settings.get().advanced.last_seen.startsWith("ISO_8601")) {
                config.discovery_payload.device_class = "timestamp";
            }
            configs.push(config);
        }
        if (isDevice && entity.definition?.ota) {
            const updateSensor = {
                type: "update",
                object_id: "update",
                mockProperties: [{ property: "update", value: { state: null } }],
                discovery_payload: {
                    name: null,
                    entity_picture: "https://github.com/Koenkk/zigbee2mqtt/raw/master/images/logo.png",
                    state_topic: true,
                    device_class: "firmware",
                    entity_category: "config",
                    command_topic: `${settings.get().mqtt.base_topic}/bridge/request/device/ota_update/update`,
                    payload_install: `{"id": "${entity.ieeeAddr}"}`,
                    value_template: `{"latest_version":"{{ value_json['update']['latest_version'] }}","installed_version":"{{ value_json['update']['installed_version'] }}","update_percentage":{{ value_json['update'].get('progress', 'null') }},"in_progress":{{ (value_json['update']['state'] == 'updating')|lower }}}`,
                },
            };
            configs.push(updateSensor);
        }
        // Discover scenes.
        for (const endpointOrGroup of isDevice ? entity.zh.endpoints : isGroup ? [entity.zh] : []) {
            for (const scene of utils_1.default.getScenes(endpointOrGroup)) {
                const sceneEntry = {
                    type: "scene",
                    object_id: `scene_${scene.id}`,
                    mockProperties: [],
                    discovery_payload: {
                        name: `${scene.name}`,
                        state_topic: false,
                        command_topic: true,
                        payload_on: `{ "scene_recall": ${scene.id} }`,
                        object_id_postfix: `_${scene.name.replace(/\s+/g, "_").toLowerCase()}`,
                    },
                };
                configs.push(sceneEntry);
            }
        }
        // deep clone of the config objects
        configs = JSON.parse(JSON.stringify(configs));
        if (entity.options.homeassistant) {
            const s = entity.options.homeassistant;
            configs = configs.filter((config) => s[config.object_id] === undefined || s[config.object_id] != null);
            for (const config of configs) {
                const configOverride = s[config.object_id];
                if (configOverride) {
                    config.object_id = configOverride.object_id || config.object_id;
                    config.type = configOverride.type || config.type;
                }
            }
        }
        return configs;
    }
    async discover(entity, publish = true) {
        // Handle type differences.
        const isDevice = entity.isDevice();
        const isGroup = entity.isGroup();
        if (isGroup && entity.zh.members.length === 0) {
            return;
        }
        if (isDevice &&
            (!entity.definition || !entity.interviewed || (entity.options.homeassistant !== undefined && !entity.options.homeassistant))) {
            return;
        }
        const discovered = this.getDiscovered(entity);
        discovered.discovered = true;
        const lastDiscoveredTopics = Object.keys(discovered.messages);
        const newDiscoveredTopics = new Set();
        for (const config of this.getConfigs(entity)) {
            const payload = { ...config.discovery_payload };
            const baseTopic = `${settings.get().mqtt.base_topic}/${entity.name}`;
            let stateTopic = baseTopic;
            if (payload.state_topic_postfix) {
                stateTopic += `/${payload.state_topic_postfix}`;
                delete payload.state_topic_postfix;
            }
            if (payload.state_topic === undefined || payload.state_topic) {
                payload.state_topic = stateTopic;
            }
            else {
                if (payload.state_topic !== undefined) {
                    delete payload.state_topic;
                }
            }
            if (payload.position_topic) {
                payload.position_topic = stateTopic;
            }
            if (payload.tilt_status_topic) {
                payload.tilt_status_topic = stateTopic;
            }
            const devicePayload = this.getDevicePayload(entity);
            // Suggest object_id (entity_id) for entity
            payload.object_id = devicePayload.name.replace(/\s+/g, "_").toLowerCase();
            if (config.object_id.startsWith(config.type) && config.object_id.includes("_")) {
                payload.object_id += `_${config.object_id.split(/_(.+)/)[1]}`;
            }
            else if (!config.object_id.startsWith(config.type)) {
                payload.object_id += `_${config.object_id}`;
            }
            // Allow customization of the `payload.object_id` without touching the other uses of `config.object_id`
            // (e.g. for setting the `payload.unique_id` and as an internal key).
            payload.object_id = `${payload.object_id}${payload.object_id_postfix ?? ""}`;
            delete payload.object_id_postfix;
            // Set unique_id
            payload.unique_id = `${entity.options.ID}_${config.object_id}_${settings.get().mqtt.base_topic}`;
            // Attributes for device registry and origin
            payload.device = devicePayload;
            payload.origin = this.discoveryOrigin;
            // Availability payload (can be disabled by setting `payload.availability = false`).
            if (payload.availability === undefined || payload.availability) {
                payload.availability = [{ topic: `${settings.get().mqtt.base_topic}/bridge/state` }];
                if (isDevice || isGroup) {
                    if (utils_1.default.isAvailabilityEnabledForEntity(entity, settings.get())) {
                        payload.availability_mode = "all";
                        payload.availability.push({ topic: `${baseTopic}/availability` });
                    }
                }
                else {
                    // Bridge availability is different.
                    payload.availability_mode = "all";
                }
                if (isDevice && entity.options.disabled) {
                    // Mark disabled device always as unavailable
                    for (const entry of payload.availability) {
                        entry.value_template = '{{ "offline" }}';
                    }
                }
                else {
                    for (const entry of payload.availability) {
                        entry.value_template = "{{ value_json.state }}";
                    }
                }
            }
            else {
                delete payload.availability;
            }
            const commandTopicPrefix = payload.command_topic_prefix ? `${payload.command_topic_prefix}/` : "";
            delete payload.command_topic_prefix;
            const commandTopicPostfix = payload.command_topic_postfix ? `/${payload.command_topic_postfix}` : "";
            delete payload.command_topic_postfix;
            const commandTopic = `${baseTopic}/${commandTopicPrefix}set${commandTopicPostfix}`;
            if (payload.command_topic && typeof payload.command_topic !== "string") {
                payload.command_topic = commandTopic;
            }
            if (payload.set_position_topic) {
                payload.set_position_topic = commandTopic;
            }
            if (payload.tilt_command_topic) {
                payload.tilt_command_topic = `${baseTopic}/${commandTopicPrefix}set/tilt`;
            }
            if (payload.mode_state_topic) {
                payload.mode_state_topic = stateTopic;
            }
            if (payload.mode_command_topic) {
                payload.mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/system_mode`;
            }
            if (payload.current_temperature_topic) {
                payload.current_temperature_topic = stateTopic;
            }
            if (payload.temperature_state_topic) {
                payload.temperature_state_topic = stateTopic;
            }
            if (payload.temperature_low_state_topic) {
                payload.temperature_low_state_topic = stateTopic;
            }
            if (payload.temperature_high_state_topic) {
                payload.temperature_high_state_topic = stateTopic;
            }
            if (payload.temperature_command_topic) {
                payload.temperature_command_topic = `${baseTopic}/${commandTopicPrefix}set/${payload.temperature_command_topic}`;
            }
            if (payload.temperature_low_command_topic) {
                payload.temperature_low_command_topic = `${baseTopic}/${commandTopicPrefix}set/${payload.temperature_low_command_topic}`;
            }
            if (payload.temperature_high_command_topic) {
                payload.temperature_high_command_topic = `${baseTopic}/${commandTopicPrefix}set/${payload.temperature_high_command_topic}`;
            }
            if (payload.fan_mode_state_topic) {
                payload.fan_mode_state_topic = stateTopic;
            }
            if (payload.fan_mode_command_topic) {
                payload.fan_mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/fan_mode`;
            }
            if (payload.swing_mode_state_topic) {
                payload.swing_mode_state_topic = stateTopic;
            }
            if (payload.swing_mode_command_topic) {
                payload.swing_mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/swing_mode`;
            }
            if (payload.percentage_state_topic) {
                payload.percentage_state_topic = stateTopic;
            }
            if (payload.percentage_command_topic) {
                payload.percentage_command_topic = `${baseTopic}/${commandTopicPrefix}set/${payload.percentage_command_topic}`;
            }
            if (payload.preset_mode_state_topic) {
                payload.preset_mode_state_topic = stateTopic;
            }
            if (payload.preset_mode_command_topic) {
                payload.preset_mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/${payload.preset_mode_command_topic}`;
            }
            if (payload.action_topic) {
                payload.action_topic = stateTopic;
            }
            // Override configuration with user settings.
            if (entity.options.homeassistant != null) {
                const add = (obj, ignoreName) => {
                    for (const key in obj) {
                        if (key === "type" || key === "object_id") {
                            continue;
                        }
                        if (ignoreName && key === "name") {
                            continue;
                        }
                        if (["number", "string", "boolean"].includes(typeof obj[key]) || Array.isArray(obj[key])) {
                            payload[key] = obj[key];
                        }
                        else if (obj[key] === null) {
                            delete payload[key];
                        }
                        else if (key === "device" && typeof obj[key] === "object") {
                            for (const devKey in obj.device) {
                                payload.device[devKey] = obj.device[devKey];
                            }
                        }
                    }
                };
                add(entity.options.homeassistant, true);
                if (entity.options.homeassistant[config.object_id] != null) {
                    add(entity.options.homeassistant[config.object_id], false);
                }
            }
            if (entity.isDevice()) {
                try {
                    entity.definition?.meta?.overrideHaDiscoveryPayload?.(payload);
                }
                catch (error) {
                    logger_1.default.error(`Failed to override HA discovery payload (${error.stack})`);
                }
            }
            const topic = this.getDiscoveryTopic(config, entity);
            const payloadStr = (0, json_stable_stringify_without_jsonify_1.default)(payload);
            newDiscoveredTopics.add(topic);
            // Only discover when not discovered yet
            const discoveredMessage = discovered.messages[topic];
            if (!discoveredMessage || discoveredMessage.payload !== payloadStr || !discoveredMessage.published) {
                discovered.messages[topic] = { payload: payloadStr, published: publish };
                if (publish) {
                    await this.mqtt.publish(topic, payloadStr, {
                        clientOptions: { retain: true, qos: 1 },
                        baseTopic: this.discoveryTopic,
                        skipReceive: false,
                    });
                }
            }
            else {
                logger_1.default.debug(`Skipping discovery of '${topic}', already discovered`);
            }
            if (config.mockProperties) {
                for (const mockProperty of config.mockProperties) {
                    discovered.mockProperties.add(mockProperty);
                }
            }
        }
        for (const topic of lastDiscoveredTopics) {
            const isDeviceAutomation = topic.match(this.discoveryRegexWoTopic)?.[1] === "device_automation";
            if (!newDiscoveredTopics.has(topic) && !isDeviceAutomation) {
                await this.mqtt.publish(topic, "", { clientOptions: { retain: true, qos: 1 }, baseTopic: this.discoveryTopic, skipReceive: false });
            }
        }
    }
    async onMQTTMessage(data) {
        const discoveryMatch = data.topic.match(this.discoveryRegex);
        const isDeviceAutomation = discoveryMatch && discoveryMatch[1] === "device_automation";
        if (discoveryMatch) {
            // Clear outdated discovery configs and remember already discovered device_automations
            let message;
            try {
                message = JSON.parse(data.message);
                const baseTopic = `${settings.get().mqtt.base_topic}/`;
                if (isDeviceAutomation && (!message.topic || !message.topic.startsWith(baseTopic))) {
                    return;
                }
                if (!isDeviceAutomation && (!message.availability || !message.availability[0].topic.startsWith(baseTopic))) {
                    return;
                }
            }
            catch {
                return;
            }
            // Group discovery topic uses "ENCODEDBASETOPIC_GROUPID", device use ieeeAddr
            const ID = discoveryMatch[2].includes("_") ? discoveryMatch[2].split("_")[1] : discoveryMatch[2];
            const entity = ID === this.bridge.ID ? this.bridge : this.zigbee.resolveEntity(ID);
            let clear = !entity || (entity.isDevice() && !entity.definition);
            // Only save when topic matches otherwise config is not updated when renamed by editing configuration.yaml
            if (entity) {
                const key = `${discoveryMatch[3].substring(0, discoveryMatch[3].indexOf("_"))}`;
                const triggerTopic = `${settings.get().mqtt.base_topic}/${entity.name}/${key}`;
                if (isDeviceAutomation && message.topic === triggerTopic) {
                    this.getDiscovered(ID).triggers.add(discoveryMatch[3]);
                }
            }
            const topic = data.topic.substring(this.discoveryTopic.length + 1);
            if (!clear && !isDeviceAutomation && entity && !(topic in this.getDiscovered(entity).messages)) {
                clear = true;
            }
            // Device was flagged to be excluded from homeassistant discovery
            clear = clear || Boolean(entity && entity.options.homeassistant !== undefined && !entity.options.homeassistant);
            if (clear) {
                logger_1.default.debug(`Clearing outdated Home Assistant config '${data.topic}'`);
                await this.mqtt.publish(topic, "", { clientOptions: { retain: true, qos: 1 }, baseTopic: this.discoveryTopic, skipReceive: false });
            }
            else if (entity) {
                this.getDiscovered(entity).messages[topic] = { payload: (0, json_stable_stringify_without_jsonify_1.default)(message), published: true };
            }
        }
        else if (data.topic === this.statusTopic && data.message.toLowerCase() === "online") {
            const timer = setTimeout(async () => {
                // Publish all device states.
                for (const entity of this.zigbee.devicesAndGroupsIterator(utils_1.default.deviceNotCoordinator)) {
                    if (this.state.exists(entity)) {
                        await this.publishEntityState(entity, this.state.get(entity), "publishCached");
                    }
                }
                clearTimeout(timer);
            }, 30000);
        }
    }
    async onZigbeeEvent(data) {
        if (!this.getDiscovered(data.device).discovered) {
            await this.discover(data.device);
        }
    }
    async onScenesChanged(data) {
        // Re-trigger MQTT discovery of changed devices and groups, similar to bridge.ts
        // First, clear existing scene discovery topics
        logger_1.default.debug(`Clearing Home Assistant scene discovery for '${data.entity.name}'`);
        const discovered = this.getDiscovered(data.entity);
        for (const topic of Object.keys(discovered.messages)) {
            if (topic.startsWith("scene")) {
                await this.mqtt.publish(topic, "", { clientOptions: { retain: true, qos: 1 }, baseTopic: this.discoveryTopic, skipReceive: false });
                delete discovered.messages[topic];
            }
        }
        // Make sure Home Assistant deletes the old entity first otherwise another one (_2) is created
        // https://github.com/Koenkk/zigbee2mqtt/issues/12610
        logger_1.default.debug("Finished clearing scene discovery topics, waiting for Home Assistant.");
        await utils_1.default.sleep(2);
        // Re-discover entity (including any new scenes).
        logger_1.default.debug("Re-discovering entities with their scenes.");
        await this.discover(data.entity);
    }
    getDevicePayload(entity) {
        const identifierPostfix = entity.isGroup() ? `zigbee2mqtt_${this.getEncodedBaseTopic()}` : "zigbee2mqtt";
        // Allow device name to be overridden by homeassistant config
        let deviceName = entity.name;
        if (typeof entity.options.homeassistant?.name === "string") {
            deviceName = entity.options.homeassistant.name;
        }
        const payload = {
            identifiers: [`${identifierPostfix}_${entity.options.ID}`],
            name: deviceName,
            sw_version: `Zigbee2MQTT ${this.zigbee2MQTTVersion}`,
        };
        const url = settings.get().frontend?.url ?? "";
        if (entity.isDevice()) {
            (0, node_assert_1.default)(entity.definition, `Cannot 'getDevicePayload' for unsupported device`);
            payload.model = entity.definition.description;
            payload.model_id = entity.definition.model;
            payload.manufacturer = entity.definition.vendor;
            payload.sw_version = entity.zh.softwareBuildID;
            payload.hw_version = entity.zh.hardwareVersion;
            payload.configuration_url = `${url}/#/device/${entity.ieeeAddr}/info`;
        }
        else if (entity.isGroup()) {
            payload.model = "Group";
            payload.manufacturer = "Zigbee2MQTT";
            payload.configuration_url = `${url}/#/group/${entity.ID}`;
        }
        else {
            payload.model = "Bridge";
            payload.manufacturer = "Zigbee2MQTT";
            payload.hw_version = `${entity.hardwareVersion} ${entity.firmwareVersion}`;
            payload.sw_version = this.zigbee2MQTTVersion;
            payload.configuration_url = `${url}/#/settings`;
        }
        if (!url) {
            delete payload.configuration_url;
        }
        // Link devices & groups to bridge.
        if (entity !== this.bridge) {
            payload.via_device = this.bridgeIdentifier;
        }
        return payload;
    }
    adjustMessageBeforePublish(entity, message) {
        for (const mockProperty of this.getDiscovered(entity).mockProperties) {
            if (message[mockProperty.property] === undefined) {
                message[mockProperty.property] = mockProperty.value;
            }
        }
        // Copy hue -> h, saturation -> s to make homeassistant happy
        if (message.color !== undefined) {
            if (message.color.hue !== undefined) {
                message.color.h = message.color.hue;
            }
            if (message.color.saturation !== undefined) {
                message.color.s = message.color.saturation;
            }
        }
        if (entity.isDevice() && entity.definition?.ota && message.update?.latest_version == null) {
            message.update = { ...message.update, installed_version: -1, latest_version: -1 };
        }
    }
    getEncodedBaseTopic() {
        return settings
            .get()
            .mqtt.base_topic.split("")
            .map((s) => s.charCodeAt(0).toString())
            .join("");
    }
    getDiscoveryTopic(config, entity) {
        const key = entity.isDevice() ? entity.ieeeAddr : `${this.getEncodedBaseTopic()}_${entity.ID}`;
        return `${config.type}/${key}/${config.object_id}/config`;
    }
    async publishDeviceTriggerDiscover(device, key, value, force = false) {
        const haConfig = device.options.homeassistant;
        if (device.options.homeassistant !== undefined &&
            (haConfig == null || (haConfig.device_automation !== undefined && typeof haConfig === "object" && haConfig.device_automation == null))) {
            return;
        }
        const discovered = this.getDiscovered(device);
        const discoveredKey = `${key}_${value}`;
        if (discovered.triggers.has(discoveredKey) && !force) {
            return;
        }
        const config = {
            type: "device_automation",
            object_id: `${key}_${value}`,
            mockProperties: [],
            discovery_payload: {
                automation_type: "trigger",
                type: key,
            },
        };
        const topic = this.getDiscoveryTopic(config, device);
        const payload = {
            ...config.discovery_payload,
            subtype: value,
            payload: value,
            topic: `${settings.get().mqtt.base_topic}/${device.name}/${key}`,
            device: this.getDevicePayload(device),
            origin: this.discoveryOrigin,
        };
        await this.mqtt.publish(topic, (0, json_stable_stringify_without_jsonify_1.default)(payload), {
            clientOptions: { retain: true, qos: 1 },
            baseTopic: this.discoveryTopic,
            skipReceive: false,
        });
        discovered.triggers.add(discoveredKey);
    }
    getBridgeEntity(coordinatorVersion) {
        const coordinatorIeeeAddress = this.zigbee.firstCoordinatorEndpoint().deviceIeeeAddress;
        const discovery = [];
        const bridge = new Bridge(coordinatorIeeeAddress, coordinatorVersion, discovery);
        const baseTopic = `${settings.get().mqtt.base_topic}/${bridge.name}`;
        discovery.push(
        // Binary sensors.
        {
            type: "binary_sensor",
            object_id: "connection_state",
            mockProperties: [],
            discovery_payload: {
                name: "Connection state",
                device_class: "connectivity",
                entity_category: "diagnostic",
                state_topic: true,
                state_topic_postfix: "state",
                value_template: "{{ value_json.state }}",
                payload_on: "online",
                payload_off: "offline",
                availability: false,
            },
        }, {
            type: "binary_sensor",
            object_id: "restart_required",
            mockProperties: [],
            discovery_payload: {
                name: "Restart required",
                device_class: "problem",
                entity_category: "diagnostic",
                enabled_by_default: false,
                state_topic: true,
                state_topic_postfix: "info",
                value_template: "{{ value_json.restart_required }}",
                payload_on: true,
                payload_off: false,
            },
        }, 
        // Buttons.
        {
            type: "button",
            object_id: "restart",
            mockProperties: [],
            discovery_payload: {
                name: "Restart",
                device_class: "restart",
                state_topic: false,
                command_topic: `${baseTopic}/request/restart`,
                payload_press: "",
            },
        }, 
        // Selects.
        {
            type: "select",
            object_id: "log_level",
            mockProperties: [],
            discovery_payload: {
                name: "Log level",
                entity_category: "config",
                state_topic: true,
                state_topic_postfix: "info",
                value_template: "{{ value_json.log_level | lower }}",
                command_topic: `${baseTopic}/request/options`,
                command_template: '{"options": {"advanced": {"log_level": "{{ value }}" } } }',
                options: settings.LOG_LEVELS,
            },
        }, 
        // Sensors:
        {
            type: "sensor",
            object_id: "version",
            mockProperties: [],
            discovery_payload: {
                name: "Version",
                icon: "mdi:zigbee",
                entity_category: "diagnostic",
                state_topic: true,
                state_topic_postfix: "info",
                value_template: "{{ value_json.version }}",
            },
        }, {
            type: "sensor",
            object_id: "coordinator_version",
            mockProperties: [],
            discovery_payload: {
                name: "Coordinator version",
                icon: "mdi:chip",
                entity_category: "diagnostic",
                enabled_by_default: false,
                state_topic: true,
                state_topic_postfix: "info",
                value_template: "{{ value_json.coordinator.meta.revision }}",
            },
        }, {
            type: "sensor",
            object_id: "network_map",
            mockProperties: [],
            discovery_payload: {
                name: "Network map",
                entity_category: "diagnostic",
                enabled_by_default: false,
                state_topic: true,
                state_topic_postfix: "response/networkmap",
                value_template: "{{ now().strftime('%Y-%m-%d %H:%M:%S') }}",
                json_attributes_topic: `${baseTopic}/response/networkmap`,
                json_attributes_template: "{{ value_json.data.value | tojson }}",
            },
        }, 
        // Switches.
        {
            type: "switch",
            object_id: "permit_join",
            mockProperties: [],
            discovery_payload: {
                name: "Permit join",
                icon: "mdi:human-greeting-proximity",
                state_topic: true,
                state_topic_postfix: "info",
                value_template: "{{ value_json.permit_join | lower }}",
                command_topic: `${baseTopic}/request/permit_join`,
                state_on: "true",
                state_off: "false",
                payload_on: '{"time": 254}',
                payload_off: '{"time": 0}',
            },
        });
        return bridge;
    }
    parseActionValue(action) {
        // Handle standard actions.
        for (const p of ACTION_PATTERNS) {
            const m = action.match(p);
            if (m?.groups?.action) {
                return this.buildAction(m.groups);
            }
        }
        // Handle wildcard actions.
        let m = action.match(/^(?<action>recall|scene)_\*(?:_(?<endpoint>e1|e2|s1|s2))?$/);
        if (m?.groups?.action) {
            logger_1.default.debug(`Found scene wildcard action ${m.groups.action}`);
            return this.buildAction(m.groups, { scene: "wildcard" });
        }
        m = action.match(/^(?<actionPrefix>region_)\*_(?<action>enter|leave|occupied|unoccupied)$/);
        if (m?.groups?.action) {
            logger_1.default.debug(`Found region wildcard action ${m.groups.action}`);
            return this.buildAction(m.groups, { region: "wildcard" });
        }
        // If nothing matches, keep the plain action value.
        return { action };
    }
    buildAction(groups, props = {}) {
        utils_1.default.removeNullPropertiesFromObject(groups);
        let a = groups.action;
        if (groups?.actionPrefix) {
            a = groups.actionPrefix + a;
            delete groups.actionPrefix;
        }
        return { ...groups, action: a, ...props };
    }
    prepareActionEventTypes(values) {
        return utils_1.default.arrayUnique(values.map((v) => this.parseActionValue(v.toString()).action).filter((v) => !v.includes("*")));
    }
    parseGroupsFromRegex(pattern) {
        return [...pattern.matchAll(/\(\?<([a-zA-Z]+)>/g)].map((v) => v[1]);
    }
    getActionValueTemplate() {
        // TODO: Implement parsing for all event types.
        const patterns = ACTION_PATTERNS.map((v) => {
            return `{"pattern": '${v.replaceAll(/\?<([a-zA-Z]+)>/g, "?P<$1>")}', "groups": [${this.parseGroupsFromRegex(v)
                .map((g) => `"${g}"`)
                .join(", ")}]}`;
        }).join(",\n");
        const value_template = `{% set patterns = [\n${patterns}\n] %}
{% set action_value = value_json.action|default('') %}
{% set ns = namespace(r=[('action', action_value)]) %}
{% for p in patterns %}
  {% set m = action_value|regex_findall(p.pattern) %}
  {% if m[0] is undefined %}{% continue %}{% endif %}
  {% for key, value in zip(p.groups, m[0]) %}
    {% set ns.r = ns.r|rejectattr(0, 'eq', key)|list + [(key, value)] %}
  {% endfor %}
{% endfor %}
{% if (ns.r|selectattr(0, 'eq', 'actionPrefix')|first) is defined %}
  {% set ns.r = ns.r|rejectattr(0, 'eq', 'action')|list + [('action', ns.r|selectattr(0, 'eq', 'actionPrefix')|map(attribute=1)|first + ns.r|selectattr(0, 'eq', 'action')|map(attribute=1)|first)] %}
{% endif %}
{% set ns.r = ns.r + [('event_type', ns.r|selectattr(0, 'eq', 'action')|map(attribute=1)|first)] %}
{{dict.from_keys(ns.r|rejectattr(0, 'in', ('action', 'actionPrefix'))|reject('eq', ('event_type', None))|reject('eq', ('event_type', '')))|to_json}}`;
        return value_template;
    }
}
exports.HomeAssistant = HomeAssistant;
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onEntityRemoved", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onGroupMembersChanged", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onPublishEntityState", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onEntityRenamed", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onMQTTMessage", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onZigbeeEvent", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onScenesChanged", null);
exports.default = HomeAssistant;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9tZWFzc2lzdGFudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9leHRlbnNpb24vaG9tZWFzc2lzdGFudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw4REFBaUM7QUFDakMsb0VBQWtDO0FBQ2xDLGtIQUE4RDtBQUc5RCw0REFBb0M7QUFDcEMsMkRBQTZDO0FBQzdDLHVEQUE4STtBQUM5SSw0REFBb0M7QUE0QnBDLE1BQU0sZUFBZSxHQUFhO0lBQzlCLDJFQUEyRTtJQUMzRSxxREFBcUQ7SUFDckQsMEZBQTBGO0lBQzFGLDRFQUE0RTtJQUM1RSx5REFBeUQ7Q0FDNUQsQ0FBQztBQUNGLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQztBQUMzQixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDekIsTUFBTSxxQkFBcUIsR0FBMEIsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMxRixNQUFNLG9CQUFvQixHQUEwQixDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNuRyxNQUFNLG9CQUFvQixHQUEwQixDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQzdILE1BQU0sb0JBQW9CLEdBQTBCLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDM0YsTUFBTSxnQkFBZ0IsR0FBMEIsQ0FBQyxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDbEgsTUFBTSx1QkFBdUIsR0FBNEI7SUFDckQsc0JBQXNCLEVBQUUsRUFBQyxJQUFJLEVBQUUsWUFBWSxF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