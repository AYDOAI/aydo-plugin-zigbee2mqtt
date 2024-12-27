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
exports.YAMLFileException = void 0;
const fs_1 = __importDefault(require("fs"));
const es6_1 = __importDefault(require("fast-deep-equal/es6"));
const js_yaml_1 = __importStar(require("js-yaml"));
class YAMLFileException extends js_yaml_1.YAMLException {
    file;
    constructor(error, file) {
        super(error.reason, error.mark);
        this.name = 'YAMLFileException';
        this.cause = error.cause;
        this.message = error.message;
        this.stack = error.stack;
        this.file = file;
    }
}
exports.YAMLFileException = YAMLFileException;
function read(file) {
    try {
        const result = js_yaml_1.default.load(fs_1.default.readFileSync(file, 'utf8'));
        return result ?? {};
    }
    catch (error) {
        if (error instanceof js_yaml_1.YAMLException) {
            throw new YAMLFileException(error, file);
        }
        throw error;
    }
}
function readIfExists(file, fallback = {}) {
    return fs_1.default.existsSync(file) ? read(file) : fallback;
}
function writeIfChanged(file, content) {
    const before = readIfExists(file);
    if (!(0, es6_1.default)(before, content)) {
        fs_1.default.writeFileSync(file, js_yaml_1.default.dump(content));
    }
}
function updateIfChanged(file, key, value) {
    const content = read(file);
    if (content[key] !== value) {
        content[key] = value;
        writeIfChanged(file, content);
    }
}
exports.default = { read, readIfExists, updateIfChanged, writeIfChanged };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieWFtbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi91dGlsL3lhbWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSw0Q0FBb0I7QUFFcEIsOERBQXlDO0FBQ3pDLG1EQUE0QztBQUU1QyxNQUFhLGlCQUFrQixTQUFRLHVCQUFhO0lBQ2hELElBQUksQ0FBUztJQUViLFlBQVksS0FBb0IsRUFBRSxJQUFZO1FBQzFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVoQyxJQUFJLENBQUMsSUFBSSxHQUFHLG1CQUFtQixDQUFDO1FBQ2hDLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQztRQUN6QixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7UUFDN0IsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO1FBQ3pCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ3JCLENBQUM7Q0FDSjtBQVpELDhDQVlDO0FBRUQsU0FBUyxJQUFJLENBQUMsSUFBWTtJQUN0QixJQUFJLENBQUM7UUFDRCxNQUFNLE1BQU0sR0FBRyxpQkFBSSxDQUFDLElBQUksQ0FBQyxZQUFFLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3hELE9BQVEsTUFBbUIsSUFBSSxFQUFFLENBQUM7SUFDdEMsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDYixJQUFJLEtBQUssWUFBWSx1QkFBYSxFQUFFLENBQUM7WUFDakMsTUFBTSxJQUFJLGlCQUFpQixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM3QyxDQUFDO1FBRUQsTUFBTSxLQUFLLENBQUM7SUFDaEIsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFTLFlBQVksQ0FBQyxJQUFZLEVBQUUsV0FBcUIsRUFBRTtJQUN2RCxPQUFPLFlBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ3ZELENBQUM7QUFFRCxTQUFTLGNBQWMsQ0FBQyxJQUFZLEVBQUUsT0FBaUI7SUFDbkQsTUFBTSxNQUFNLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRWxDLElBQUksQ0FBQyxJQUFBLGFBQU0sRUFBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUMzQixZQUFFLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxpQkFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQy9DLENBQUM7QUFDTCxDQUFDO0FBRUQsU0FBUyxlQUFlLENBQUMsSUFBWSxFQUFFLEdBQVcsRUFBRSxLQUFlO0lBQy9ELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMzQixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQztRQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDbEMsQ0FBQztBQUNMLENBQUM7QUFFRCxrQkFBZSxFQUFDLElBQUksRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLGNBQWMsRUFBQyxDQUFDIn0=