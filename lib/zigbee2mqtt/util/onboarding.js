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
exports.onboard = onboard;
const node_fs_1 = require("node:fs");
const node_http_1 = require("node:http");
const node_querystring_1 = require("node:querystring");
const adapterDiscovery_1 = require("zigbee-herdsman/dist/adapter/adapterDiscovery");
const data_1 = __importDefault(require("./data"));
const settings = __importStar(require("./settings"));
const settingsMigration = __importStar(require("./settingsMigration"));

function escapeHtml(s) {
    return s.replace(/[^0-9A-Za-z \-_.]/g, (c) => `&#${c.charCodeAt(0)};`);
}
function generateHtmlDone(frontendUrl) {
    return `
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Zigbee2MQTT Onboarding</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.classless.min.css">
</head>
<body>
    <main>
        <h1>Zigbee2MQTT Onboarding</h1>
        <p>Settings saved.</p>
        <p>Zigbee2MQTT is now starting...</p>
        <small>${frontendUrl ? `Redirecting to Zigbee2MQTT frontend at <a href="${frontendUrl}">${frontendUrl}</a> in 30 seconds.` : "You can close this page."}</small>
    </main>
    ${frontendUrl ? `<script>setTimeout(() => { window.location.replace("${frontendUrl}"); }, 30000);</script>` : ""}
</body>
</html>
`;
}
function generateHtmlForm(currentSettings, devices) {
    let devicesSelect = "";
    if (devices.length > 0) {
        devicesSelect += '<select id="found_device" onchange="setFoundDevice(this)">';
        devicesSelect += '<option value="">Select a device</option>';
        for (const device of devices) {
            // just in case name has commas, remove them to not mess with `split` logic
            const deviceStr = `${device.name.replaceAll(",", "")}, ${device.path}, ${device.adapter ?? "unknown"}`;
            devicesSelect += `<option value="${deviceStr}">${deviceStr}</option>`;
        }
        devicesSelect += "</select>";
        devicesSelect += "<small>Optionally allows to configure coordinator port and type (if known) automatically.</small>";
    }
    else {
        devicesSelect = "<small>No device found</small>";
    }
    let generateCheckbox = "";
    if (Array.isArray(currentSettings.advanced?.network_key) ||
        typeof currentSettings.advanced?.pan_id === "number" ||
        Array.isArray(currentSettings.advanced?.ext_pan_id)) {
        generateCheckbox = `
<label for="generate_network">
    <input
        type="checkbox"
        id="generate_network"
        onclick="setGenerate(this)"
        ${process.env.ZIGBEE2MQTT_CONFIG_ADVANCED_NETWORK_KEY || process.env.ZIGBEE2MQTT_CONFIG_ADVANCED_PAN_ID || process.env.ZIGBEE2MQTT_CONFIG_ADVANCED_EXT_PAN_ID ? "disabled" : ""}>
    Generate network?
</label>
`;
    }
    /* v8 ignore start */
    return `
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Zigbee2MQTT Onboarding</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.classless.min.css">
</head>
<body>
    <main>
        <h1>Zigbee2MQTT Onboarding</h1>
        <p>Set the base configuration to start Zigbee2MQTT.</p>
        <p>Optional fields will either be ignored or fallback to defaults if not set (see appropriate documentation page for more details).</p>
        <p>If a field is disabled, it means <a href="https://www.zigbee2mqtt.io/guide/configuration/#environment-variables" target="_blank">environment variables</a> are being used to override specific values (for example, through the Home Assistant add-on configuration page).</p>
        <hr>
        <form method="post">
            <fieldset ${process.env.ZIGBEE2MQTT_CONFIG_SERIAL || process.env.ZIGBEE2MQTT_CONFIG_SERIAL_PORT || process.env.ZIGBEE2MQTT_CONFIG_SERIAL_ADAPTER ? "disabled" : ""}>
                <label for="found_device">Found Devices</label>
                ${devicesSelect}
            </fieldset>
            <fieldset ${process.env.ZIGBEE2MQTT_CONFIG_SERIAL ? "disabled" : ""}>
                <label for="serial_port">Coordinator/Adapter Port/Path</label>
                <input
                    type="text"
                    id="serial_port"
                    name="serial_port"
                    value="${currentSettings.serial?.port ?? ""}"
                    required
                    ${process.env.ZIGBEE2MQTT_CONFIG_SERIAL_PORT ? "disabled" : ""}>
                <label for="serial_adapter">Coordinator/Adapter Type/Stack/Driver</label>
                <select id="serial_adapter" name="serial_adapter" required ${process.env.ZIGBEE2MQTT_CONFIG_SERIAL_ADAPTER ? "disabled" : ""}>
                    <option value="zstack" ${currentSettings.serial?.adapter === "zstack" ? "selected" : ""}>zstack</option>
                    <option value="ember" ${currentSettings.serial?.adapter === "ember" ? "selected" : ""}>ember</option>
                    <option value="deconz" ${currentSettings.serial?.adapter === "deconz" ? "selected" : ""}>deconz</option>
                    <option value="zigate" ${currentSettings.serial?.adapter === "zigate" ? "selected" : ""}>zigate</option>
                    <option value="zboss" ${currentSettings.serial?.adapter === "zboss" ? "selected" : ""}>zboss</option>
                </select>
                <label for="serial_baudrate">Coordinator/Adapter Baudrate</label>
                <select id="serial_baudrate" name="serial_baudrate" ${process.env.ZIGBEE2MQTT_CONFIG_SERIAL_BAUDRATE ? "disabled" : ""}>
                    <option value="38400" ${currentSettings.serial?.baudrate === 38400 ? "selected" : ""}>38400</option>
                    <option value="57600" ${currentSettings.serial?.baudrate === 57600 ? "selected" : ""}>57600</option>
                    <option value="115200" ${!currentSettings.serial?.baudrate || currentSettings.serial?.baudrate === 115200 ? "selected" : ""}>115200</option>
                    <option value="230400" ${currentSettings.serial?.baudrate === 230400 ? "selected" : ""}>230400</option>
                    <option value="460800" ${currentSettings.serial?.baudrate === 460800 ? "selected" : ""}>460800</option>
                    <option value="921600" ${currentSettings.serial?.baudrate === 921600 ? "selected" : ""}>921600</option>
                </select>
                <small>Can be ignored for networked coordinators (TCP).</small>
                <label for="serial_rtscts">Coordinator/Adapter Hardware Flow Control ("rtscts: true")</label>
                <input
                    type="checkbox"
                    id="serial_rtscts"
                    name="serial_rtscts"
                    ${currentSettings.serial?.rtscts ? "checked" : ""}
                    style="margin-bottom: 1rem;">
                <small>Can be ignored for networked coordinators (TCP).</small>
            </fieldset>
            <small>
                <a href="https://www.zigbee2mqtt.io/guide/configuration/adapter-settings.html" target="_blank">https://www.zigbee2mqtt.io/guide/configuration/adapter-settings.html</a>
            </small>
            <hr>
            <fieldset ${process.env.ZIGBEE2MQTT_CONFIG_ADVANCED ? "disabled" : ""}>
                <label for="closest_wifi_channel">Closest WiFi Channel</label>
                <input
                    type="number"
                    min="0"
                    max="14"
                    id="closest_wifi_channel"
                    value="0"
                    onclick="setBestZigbeeChannel(this)"
                    ${process.env.ZIGBEE2MQTT_CONFIG_ADVANCED_CHANNEL ? "disabled" : ""}>
                <small>Optionally set to your closest WiFi channel to pick the best value for "Network channel" below.</small>
                <label for="network_channel">Network Channel</label>
                <input
                    type="number"
                    min="11"
                    max="26"
                    id="network_channel"
                    name="network_channel"
                    value="${currentSettings.advanced?.channel ?? "25"}"
                    required
                    ${process.env.ZIGBEE2MQTT_CONFIG_ADVANCED_CHANNEL ? "disabled" : ""}>
            </fieldset>
            <fieldset ${process.env.ZIGBEE2MQTT_CONFIG_ADVANCED ? "disabled" : ""}>
                ${generateCheckbox}
                <label for="network_key">Network Key</label>
                <input
                    type="text"
                    id="network_key"
                    name="network_key"
                    value="${currentSettings.advanced?.network_key ?? "GENERATE"}"
                    pattern="^([0-9]+(,[0-9]+){15})|GENERATE$"
                    required
                    ${process.env.ZIGBEE2MQTT_CONFIG_ADVANCED_NETWORK_KEY ? "disabled" : ""}>
                <label for="network_pan_id">Network PAN ID</label>
                <input
                    type="text"
                    id="network_pan_id"
                    name="network_pan_id"
                    value="${currentSettings.advanced?.pan_id ?? "GENERATE"}"
                    pattern="^([0-9]{1,5})|GENERATE$"
                    required
                    ${process.env.ZIGBEE2MQTT_CONFIG_ADVANCED_PAN_ID ? "disabled" : ""}>
                <label for="network_ext_pan_id">Network Extended PAN ID</label>
                <input
                    type="text"
                    id="network_ext_pan_id"
                    name="network_ext_pan_id"
                    value="${currentSettings.advanced?.ext_pan_id ?? "GENERATE"}"
                    pattern="^([0-9]+(,[0-9]+){7})|GENERATE$"
                    required
                    ${process.env.ZIGBEE2MQTT_CONFIG_ADVANCED_EXT_PAN_ID ? "disabled" : ""}>
            </fieldset>
            <small>
                <a href="https://www.zigbee2mqtt.io/guide/configuration/zigbee-network.html" target="_blank">https://www.zigbee2mqtt.io/guide/configuration/zigbee-network.html</a>
            </small>
            <hr>
            <fieldset ${process.env.ZIGBEE2MQTT_CONFIG_MQTT ? "disabled" : ""}>
                <label for="mqtt_base_topic">MQTT Base Topic</label>
                <input
                    type="text"
                    id="mqtt_base_topic"
                    name="mqtt_base_topic"
                    value="${currentSettings.mqtt?.base_topic ?? "zigbee2mqtt"}"
                    required
                    ${process.env.ZIGBEE2MQTT_CONFIG_MQTT_BASE_TOPIC ? "disabled" : ""}>
                <label for="mqtt_server">MQTT Server</label>
                <input
                    type="text"
                    id="mqtt_server"
                    name="mqtt_server"
                    value="${currentSettings.mqtt?.server ?? "mqtt://localhost:1883"}"
                    required
                    ${process.env.ZIGBEE2MQTT_CONFIG_MQTT_SERVER ? "disabled" : ""}>
                <label for="mqtt_user">MQTT User</label>
                <input
                    type="text"
                    id="mqtt_user"
                    name="mqtt_user"
                    value="${currentSettings.mqtt?.user ?? ""}"
                    ${process.env.ZIGBEE2MQTT_CONFIG_MQTT_USER ? "disabled" : ""}>
                <small>Optional. Set only if using authentication.</small>
                <label for="mqtt_password">MQTT Password</label>
                <input
                    type="password"
                    id="mqtt_password"
                    name="mqtt_password"
                    value="${currentSettings.mqtt?.password ?? ""}"
                    ${process.env.ZIGBEE2MQTT_CONFIG_MQTT_PASSWORD ? "disabled" : ""}>
                <small>Optional. Set only if using authentication.</small>
            </fieldset>
            <small>
                <a href="https://www.zigbee2mqtt.io/guide/configuration/mqtt.html" target="_blank">https://www.zigbee2mqtt.io/guide/configuration/mqtt.html</a>
            </small>
            <hr>
            <fieldset ${process.env.ZIGBEE2MQTT_CONFIG_FRONTEND ? "disabled" : ""}>
                <label for="frontend_enabled">
                    <input
                        type="checkbox"
                        id="frontend_enabled"
                        name="frontend_enabled"
                        ${currentSettings.frontend?.enabled ? "checked" : ""}
                        ${process.env.ZIGBEE2MQTT_CONFIG_FRONTEND_ENABLED ? "disabled" : ""}>
                    Frontend enabled?
                </label>
                <label for="frontend_port">Frontend Port</label>
                <input
                    type="number"
                    min="0"
                    max="65535"
                    id="frontend_port"
                    name="frontend_port"
                    value="${currentSettings.frontend?.port ?? "8080"}"
                    required
                    ${process.env.ZIGBEE2MQTT_CONFIG_FRONTEND_PORT ? "disabled" : ""}>
            </fieldset>
            <small>
                <a href="https://www.zigbee2mqtt.io/guide/configuration/frontend.html" target="_blank">https://www.zigbee2mqtt.io/guide/configuration/frontend.html</a>
            </small>
            <fieldset ${process.env.ZIGBEE2MQTT_CONFIG_HOMEASSISTANT ? "disabled" : ""}>
                <label for="homeassistant_enabled" ${process.env.ZIGBEE2MQTT_CONFIG_HOMEASSISTANT_ENABLED ? "disabled" : ""}>
                    <input type="checkbox" id="homeassistant_enabled" name="homeassistant_enabled" ${currentSettings.homeassistant?.enabled ? "checked" : ""}>
                    Home Assistant enabled?
                </label>
            </fieldset>
            <small>
                <a href="https://www.zigbee2mqtt.io/guide/configuration/homeassistant.html" target="_blank">https://www.zigbee2mqtt.io/guide/configuration/homeassistant.html</a>
            </small>
            <hr>
            <fieldset ${process.env.ZIGBEE2MQTT_CONFIG_ADVANCED ? "disabled" : ""}>
                <label for="log_level">Log Level</label>
                <select id="log_level" name="log_level" ${process.env.ZIGBEE2MQTT_CONFIG_ADVANCED_LOG_LEVEL ? "disabled" : ""}>
                    <option value="error" ${currentSettings.advanced?.log_level === "error" ? "selected" : ""}>error</option>
                    <option value="warning" ${currentSettings.advanced?.log_level === "warning" ? "selected" : ""}>warning</option>
                    <option value="info" ${!currentSettings.advanced?.log_level || currentSettings.advanced?.log_level === "info" ? "selected" : ""}>info</option>
                    <option value="debug" ${currentSettings.advanced?.log_level === "debug" ? "selected" : ""}>debug</option>
                </select>
            </fieldset>
            <small>
                <a href="https://www.zigbee2mqtt.io/guide/configuration/logging.html" target="_blank">https://www.zigbee2mqtt.io/guide/configuration/logging.html</a>
            </small>
            <hr>
            <input type="submit" value="Submit">
        </form>
    </main>
    <script>
        function setFoundDevice(e) {
            if (!e.value) {
                return;
            }

            const [, path, adapter] = e.value.split(", ");
            const serialPortEl = document.querySelector("#serial_port");
            serialPortEl.value = path;
            const serialAdapterEl = document.querySelector("#serial_adapter");

            if (['zstack', 'ember', 'deconz', 'zigate', 'zboss'].includes(adapter)) {
                serialAdapterEl.value = adapter;
            } else {
                serialAdapterEl.value = '';
            }
        }

        function setBestZigbeeChannel(e) {
            const wifiChannel = parseInt(e.value, 10);
            const networkChannelEl = document.querySelector("#network_channel");

            if (wifiChannel >= 11) {
                // WiFi 11-14
                networkChannelEl.value = 15;
            } else if (wifiChannel >= 6) {
                // WiFi 6-10
                networkChannelEl.value = 11;
            } else {
                // WiFi 1-5
                networkChannelEl.value = 25;
            }
        }

        function setGenerate(e) {
            document.querySelector("#network_key").value = e.checked ? "GENERATE" : "${currentSettings.advanced?.network_key ?? "GENERATE"}";
            document.querySelector("#network_pan_id").value = e.checked ? "GENERATE" : "${currentSettings.advanced?.pan_id ?? "GENERATE"}";
            document.querySelector("#network_ext_pan_id").value = e.checked ? "GENERATE" : "${currentSettings.advanced?.ext_pan_id ?? "GENERATE"}";
        }
    </script>
</body>
</html>
`;
    /* v8 ignore stop */
}
function generateHtmlError(errors) {
    return `
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Zigbee2MQTT Onboarding</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.classless.min.css">
</head>
<body>
    <main>
        <h1>Zigbee2MQTT configuration is not valid</h1>
        <p style="color: #F00;">Found the following errors:</p>
        ${errors}
        <hr>
        <p>If you don't know how to solve this, read <a href="https://www.zigbee2mqtt.io/guide/configuration" target="_blank">https://www.zigbee2mqtt.io/guide/configuration</a></p>
        <form method="post" action="/">
            <input type="submit" value="Close">
        </form>
    </main>
</body>
</html>
`;
}
function getServerUrl() {
    return new URL(process.env.Z2M_ONBOARD_URL ?? "http://0.0.0.0:8080");
}
async function startOnboardingServer() {
    const currentSettings = settings.get();
    const serverUrl = getServerUrl();
    let server;
    let failed = false;
    const success = await new Promise((resolve) => {
        server = (0, node_http_1.createServer)(async (req, res) => {
            if (req.method === "POST") {
                if (failed) {
                    res.end(() => {
                        resolve(false);
                    });
                }
                else {
                    let body = "";
                    req.on("data", (chunk) => {
                        body += chunk;
                    });
                    req.on("end", () => {
                        const result = (0, node_querystring_1.parse)(body);
                        const frontendEnabled = result.frontend_enabled === "on";
                        const updatedSettings = {
                            mqtt: {
                                base_topic: result.mqtt_base_topic,
                                server: result.mqtt_server,
                                user: result.mqtt_user || undefined, // empty string => removed
                                password: result.mqtt_password || undefined, // empty string => removed
                            },
                            serial: {
                                port: result.serial_port,
                                adapter: result.serial_adapter,
                                baudrate: result.serial_baudrate ? Number.parseInt(result.serial_baudrate, 10) : undefined,
                                rtscts: result.serial_rtscts === "on",
                            },
                            advanced: {
                                log_level: result.log_level,
                                channel: result.network_channel ? Number.parseInt(result.network_channel, 10) : undefined,
                                network_key: result.network_key
                                    ? result.network_key === "GENERATE"
                                        ? result.network_key
                                        : result.network_key.split(",").map((v) => Number.parseInt(v, 10))
                                    : undefined,
                                pan_id: result.network_pan_id
                                    ? result.network_pan_id === "GENERATE"
                                        ? result.network_pan_id
                                        : Number.parseInt(result.network_pan_id, 10)
                                    : undefined,
                                ext_pan_id: result.network_ext_pan_id
                                    ? result.network_ext_pan_id === "GENERATE"
                                        ? result.network_ext_pan_id
                                        : result.network_ext_pan_id.split(",").map((v) => Number.parseInt(v, 10))
                                    : undefined,
                            },
                            frontend: {
                                enabled: frontendEnabled,
                                port: result.frontend_port ? Number.parseInt(result.frontend_port, 10) : undefined,
                            },
                            homeassistant: {
                                enabled: result.homeassistant_enabled === "on",
                            },
                        };
                        try {
                            settings.apply(updatedSettings);
                            // to redirect, make sure frontend "will be" enabled, and host isn't socket
                            const redirect = !process.env.Z2M_ONBOARD_NO_REDIRECT &&
                                frontendEnabled &&
                                (!currentSettings.frontend?.host || !currentSettings.frontend.host.startsWith("/"));
                            const protocol = currentSettings.frontend?.ssl_cert && currentSettings.frontend.ssl_key ? "https" : "http";
                            res.setHeader("Content-Type", "text/html");
                            res.writeHead(200);
                            res.end(generateHtmlDone(redirect
                                ? /* v8 ignore next */ `${protocol}://${currentSettings.frontend?.host ?? "localhost"}:${currentSettings.frontend?.port ?? "8080"}${currentSettings.frontend?.base_url ?? "/"}`
                                : undefined), () => {
                                resolve(true);
                            });
                        }
                        catch (error) {
                            console.error(`Failed to apply configuration: ${error.message}`);
                            failed = true;
                            if (process.env.Z2M_ONBOARD_NO_FAILURE_PAGE) {
                                res.end(() => {
                                    resolve(false);
                                });
                            }
                            else {
                                res.setHeader("Content-Type", "text/html");
                                res.writeHead(406);
                                res.end(generateHtmlError(`<p>${escapeHtml(error.message)}</p>`));
                            }
                        }
                    });
                }
            }
            else {
                res.setHeader("Content-Type", "text/html");
                res.writeHead(200);
                res.end(generateHtmlForm(currentSettings, await (0, adapterDiscovery_1.findAllDevices)()));
            }
        });
        server.listen(Number.parseInt(serverUrl.port), serverUrl.hostname, () => {
            console.log(`Onboarding page is available at ${serverUrl.href}`);
        });
    });
    await new Promise((resolve) => server?.close(resolve));
    return success;
}
async function startFailureServer(errors) {
    const serverUrl = getServerUrl();
    let server;
    await new Promise((resolve) => {
        server = (0, node_http_1.createServer)((req, res) => {
            if (req.method === "POST") {
                res.end(() => {
                    resolve();
                });
            }
            else {
                res.setHeader("Content-Type", "text/html");
                res.writeHead(406);
                res.end(generateHtmlError(errors));
            }
        });
        server.listen(Number.parseInt(serverUrl.port), serverUrl.hostname, () => {
            console.error(`Failure page is available at ${serverUrl.href}`);
        });
    });
    await new Promise((resolve) => server?.close(resolve));
}
async function onboard() {
    if (!(0, node_fs_1.existsSync)(data_1.default.getPath())) {
        (0, node_fs_1.mkdirSync)(data_1.default.getPath(), { recursive: true });
    }
    const confExists = (0, node_fs_1.existsSync)(data_1.default.joinPath("configuration.yaml"));
    if (!confExists) {
        settings.writeMinimalDefaults();
    }
    else {
        // migrate first
        const { migrateIfNecessary } = settingsMigration;
        migrateIfNecessary();
        // trigger initial writing of `ZIGBEE2MQTT_CONFIG_*` ENVs
        settings.write();
    }
    // use `configuration.yaml` file to detect "brand new install"
    // env allows to re-run onboard even with existing install
    if (!process.env.Z2M_ONBOARD_NO_SERVER && (process.env.Z2M_ONBOARD_FORCE_RUN || !confExists || settings.get().onboarding)) {
        settings.setOnboarding(true);
        const success = await startOnboardingServer();
        if (!success) {
            return false;
        }
    }
    settings.reRead();
    const errors = settings.validate();
    if (errors.length > 0) {
        let pErrors = "";
        console.error("\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("            READ THIS CAREFULLY\n");
        console.error("Refusing to start because configuration is not valid, found the following errors:");
        for (const error of errors) {
            console.error(`- ${error}`);
            pErrors += `<p>- ${escapeHtml(error)}</p>`;
        }
        console.error("\nIf you don't know how to solve this, read https://www.zigbee2mqtt.io/guide/configuration");
        console.error("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n\n");
        if (!process.env.Z2M_ONBOARD_NO_SERVER && !process.env.Z2M_ONBOARD_NO_FAILURE_PAGE) {
            await startFailureServer(pErrors);
        }
        return false;
    }
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib25ib2FyZGluZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi91dGlsL29uYm9hcmRpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3Z0JBLDBCQTBEQztBQWxrQkQscUNBQThDO0FBQzlDLHlDQUF1QztBQUN2Qyx1REFBdUM7QUFFdkMsb0ZBQTZFO0FBRTdFLGtEQUEwQjtBQUMxQixxREFBdUM7QUFxQnZDLFNBQVMsVUFBVSxDQUFDLENBQVM7SUFDekIsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLG9CQUFvQixFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzNFLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLFdBQStCO0lBQ3JELE9BQU87Ozs7Ozs7Ozs7Ozs7O2lCQWNNLFdBQVcsQ0FBQyxDQUFDLENBQUMsbURBQW1ELFdBQVcsS0FBSyxXQUFXLHFCQUFxQixDQUFDLENBQUMsQ0FBQywwQkFBMEI7O01BRXpKLFdBQVcsQ0FBQyxDQUFDLENBQUMsdURBQXVELFdBQVcseUJBQXlCLENBQUMsQ0FBQyxDQUFDLEVBQUU7OztDQUduSCxDQUFDO0FBQ0YsQ0FBQztBQUVELFNBQVMsZ0JBQWdCLENBQUMsZUFBMkMsRUFBRSxPQUFtRDtJQUN0SCxJQUFJLGFBQWEsR0FBRyxFQUFFLENBQUM7SUFFdkIsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ3JCLGFBQWEsSUFBSSw0REFBNEQsQ0FBQztRQUM5RSxhQUFhLElBQUksMkNBQTJDLENBQUM7UUFFN0QsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUMzQiwyRUFBMkU7WUFDM0UsTUFBTSxTQUFTLEdBQUcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUs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