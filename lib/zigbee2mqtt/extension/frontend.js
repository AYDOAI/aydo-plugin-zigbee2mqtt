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
exports.Frontend = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const node_fs_1 = require("node:fs");
const node_http_1 = require("node:http");
const node_https_1 = require("node:https");
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const express_static_gzip_1 = __importDefault(require("express-static-gzip"));
const finalhandler_1 = __importDefault(require("finalhandler"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const ws_1 = __importDefault(require("ws"));
const data_1 = __importDefault(require("../util/data"));
const logger_1 = __importDefault(require("../util/logger"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importDefault(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
const frontend_1 = __importDefault(require("zigbee2mqtt-frontend"));
/**
 * This extension servers the frontend
 */
class Frontend extends extension_1.default {
    mqttBaseTopic;
    server;
    fileServer;
    deviceIconsFileServer;
    wss;
    baseUrl;
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension) {
        super(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension);
        const frontendSettings = settings.get().frontend;
        (0, node_assert_1.default)(frontendSettings.enabled, `Frontend extension created with setting 'enabled: false'`);
        this.baseUrl = frontendSettings.base_url;
        this.mqttBaseTopic = settings.get().mqtt.base_topic;
    }
    async start() {
        const hasSSL = (val, key) => {
            if (val) {
                if (!(0, node_fs_1.existsSync)(val)) {
                    logger_1.default.error(`Defined ${key} '${val}' file path does not exists, server won't be secured.`);
                    return false;
                }
                return true;
            }
            return false;
        };
        const { host, port, ssl_key: sslKey, ssl_cert: sslCert } = settings.get().frontend;
        const options = {
            enableBrotli: true,
            // TODO: https://github.com/Koenkk/zigbee2mqtt/issues/24654 - enable compressed index serving when express-static-gzip is fixed.
            index: false,
            serveStatic: {
                index: "index.html",
                /* v8 ignore start */
                setHeaders: (res, path) => {
                    if (path.endsWith("index.html")) {
                        res.setHeader("Cache-Control", "no-store");
                    }
                },
                /* v8 ignore stop */
            },
        };

        this.fileServer = (0, express_static_gzip_1.default)(frontend_1.default.getPath(), options);
        this.deviceIconsFileServer = (0, express_static_gzip_1.default)(data_1.default.joinPath("device_icons"), options);
        this.wss = new ws_1.default.Server({ noServer: true, path: node_path_1.posix.join(this.baseUrl, "api") });
        this.wss.on("connection", this.onWebSocketConnection);
        if (hasSSL(sslKey, "ssl_key") && hasSSL(sslCert, "ssl_cert")) {
            const serverOptions = { key: (0, node_fs_1.readFileSync)(sslKey), cert: (0, node_fs_1.readFileSync)(sslCert) };
            this.server = (0, node_https_1.createServer)(serverOptions, this.onRequest);
        }
        else {
            this.server = (0, node_http_1.createServer)(this.onRequest);
        }
        this.server.on("upgrade", this.onUpgrade);
        this.eventBus.onMQTTMessagePublished(this, this.onMQTTPublishMessageOrEntityState);
        this.eventBus.onPublishEntityState(this, this.onMQTTPublishMessageOrEntityState);
        if (!host) {
            this.server.listen(port);
            logger_1.default.info(`Started frontend on port ${port}`);
        }
        else if (host.startsWith("/")) {
            this.server.listen(host);
            logger_1.default.info(`Started frontend on socket ${host}`);
        }
        else {
            this.server.listen(port, host);
            logger_1.default.info(`Started frontend on port ${host}:${port}`);
        }
    }
    async stop() {
        await super.stop();
        if (this.wss) {
            for (const client of this.wss.clients) {
                client.send((0, json_stable_stringify_without_jsonify_1.default)({ topic: "bridge/state", payload: { state: "offline" } }));
                client.terminate();
            }
            this.wss.close();
        }
        await new Promise((resolve) => this.server?.close(resolve));
    }
    onRequest(request, response) {
        const fin = (0, finalhandler_1.default)(request, response);
        // biome-ignore lint/style/noNonNullAssertion: `Only valid for request obtained from Server`
        const newUrl = node_path_1.posix.relative(this.baseUrl, request.url);
        // The request url is not within the frontend base url, so the relative path starts with '..'
        if (newUrl.startsWith(".")) {
            fin();
            return;
        }
        // Attach originalUrl so that static-server can perform a redirect to '/' when serving the root directory.
        // This is necessary for the browser to resolve relative assets paths correctly.
        request.originalUrl = request.url;
        request.url = `/${newUrl}`;
        request.path = request.url;
        if (newUrl.startsWith("device_icons/")) {
            request.path = request.path.replace("device_icons/", "");
            request.url = request.url.replace("/device_icons", "");
            this.deviceIconsFileServer(request, response, fin);
        }
        else {
            this.fileServer(request, response, fin);
        }
    }
    onUpgrade(request, socket, head) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
            // biome-ignore lint/style/noNonNullAssertion: `Only valid for request obtained from Server`
            const { query } = (0, node_url_1.parse)(request.url, true);
            const authToken = settings.get().frontend.auth_token;
            if (!authToken || authToken === query.token) {
                this.wss.emit("connection", ws, request);
            }
            else {
                ws.close(4401, "Unauthorized");
            }
        });
    }
    onWebSocketConnection(ws) {
        ws.on("error", (msg) => logger_1.default.error(`WebSocket error: ${msg.message}`));
        ws.on("message", (data, isBinary) => {
            if (!isBinary && data) {
                const message = data.toString();
                const { topic, payload } = JSON.parse(message);
                this.mqtt.onMessage(`${this.mqttBaseTopic}/${topic}`, Buffer.from((0, json_stable_stringify_without_jsonify_1.default)(payload)));
            }
        });
        for (const [topic, payload] of Object.entries(this.mqtt.retainedMessages)) {
            if (topic.startsWith(`${this.mqttBaseTopic}/`)) {
                ws.send((0, json_stable_stringify_without_jsonify_1.default)({
                    // Send topic without base_topic
                    topic: topic.substring(this.mqttBaseTopic.length + 1),
                    payload: utils_1.default.parseJSON(payload.payload, payload.payload),
                }));
            }
        }
        for (const device of this.zigbee.devicesIterator(utils_1.default.deviceNotCoordinator)) {
            const payload = this.state.get(device);
            const lastSeen = settings.get().advanced.last_seen;
            if (lastSeen !== "disable") {
                payload.last_seen = utils_1.default.formatDate(device.zh.lastSeen ?? /* v8 ignore next */ 0, lastSeen);
            }
            if (device.zh.linkquality !== undefined) {
                payload.linkquality = device.zh.linkquality;
            }
            ws.send((0, json_stable_stringify_without_jsonify_1.default)({ topic: device.name, payload }));
        }
    }
    onMQTTPublishMessageOrEntityState(data) {
        let topic;
        let payload;
        if ("topic" in data) {
            // MQTTMessagePublished
            if (data.options.meta.isEntityState || !data.topic.startsWith(`${this.mqttBaseTopic}/`)) {
                // Don't send entity state to frontend on `MQTTMessagePublished` event, this is handled by
                // `PublishEntityState` instead. Reason for this is to skip attribute messages when `output` is
                // set to `attribute` or `attribute_and_json`, we only want to send JSON entity states to the
                // frontend.
                return;
            }
            // Send topic without base_topic
            topic = data.topic.substring(this.mqttBaseTopic.length + 1);
            payload = utils_1.default.parseJSON(data.payload, data.payload);
        }
        else {
            // PublishEntityState
            topic = data.entity.name;
            payload = data.message;
        }
        for (const client of this.wss.clients) {
            if (client.readyState === ws_1.default.OPEN) {
                client.send((0, json_stable_stringify_without_jsonify_1.default)({ topic, payload }));
            }
        }
    }
}
exports.Frontend = Frontend;
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onRequest", null);
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onUpgrade", null);
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onWebSocketConnection", null);
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onMQTTPublishMessageOrEntityState", null);
exports.default = Frontend;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJvbnRlbmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvZXh0ZW5zaW9uL2Zyb250ZW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhEQUFpQztBQUNqQyxxQ0FBaUQ7QUFFakQseUNBQXVDO0FBQ3ZDLDJDQUE4RDtBQUU5RCx5Q0FBZ0M7QUFDaEMsdUNBQStCO0FBQy9CLG9FQUFrQztBQUVsQyw4RUFBb0Q7QUFDcEQsZ0VBQXdDO0FBQ3hDLGtIQUE4RDtBQUM5RCw0Q0FBMkI7QUFFM0Isd0RBQWdDO0FBQ2hDLDREQUFvQztBQUNwQywyREFBNkM7QUFDN0MsMERBQWtDO0FBQ2xDLDREQUFvQztBQUVwQzs7R0FFRztBQUNILE1BQWEsUUFBUyxTQUFRLG1CQUFTO0lBQzNCLGFBQWEsQ0FBUztJQUN0QixNQUFNLENBQVU7SUFDaEIsVUFBVSxDQUFrQjtJQUM1QixxQkFBcUIsQ0FBa0I7SUFDdkMsR0FBRyxDQUFvQjtJQUN2QixPQUFPLENBQVM7SUFFeEIsWUFDSSxNQUFjLEVBQ2QsSUFBVSxFQUNWLEtBQVksRUFDWixrQkFBc0MsRUFDdEMsUUFBa0IsRUFDbEIsc0JBQXdFLEVBQ3hFLGVBQW9DLEVBQ3BDLFlBQXFEO1FBRXJELEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBRWhILE1BQU0sZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQztRQUNqRCxJQUFBLHFCQUFNLEVBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLDBEQUEwRCxDQUFDLENBQUM7UUFDN0YsSUFBSSxDQUFDLE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUM7UUFDekMsSUFBSSxDQUFDLGFBQWEs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