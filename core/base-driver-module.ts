import * as path from 'path';
import * as fs from 'fs';
import {EventTypes} from '../enums/event-types';
import {baseModule} from './base-module';
import * as winston from 'winston';

const {toExtendable} = require('../lib/foibles');
const moment = require('moment');

export const baseDriverModule = toExtendable(class baseDriverModule extends baseModule {

  // @ts-ignore
  lastMemoryUsage;
  // @ts-ignore
  lastMemoryUsageTime;
  // @ts-ignore
  params;
  // @ts-ignore
  ident;
  // @ts-ignore
  environment;
  // @ts-ignore
  cloud;
  queue: any = {};
  // @ts-ignore
  pluginName;
  // @ts-ignore
  pluginTemplate;
  // @ts-ignore
  statusCache: any = {};
  // @ts-ignore
  logging;
  // @ts-ignore
  logConfig = {'request': false, 'response': false};
  app = {
    // @ts-ignore
    logMessage: (...optionalParameters) => {
      let message = `${this.datetime()} ${this.memoryUsage()}`;
      for (let i = 0; i < optionalParameters.length; i++) {
        const msg = typeof optionalParameters[i] === 'object' ? JSON.stringify(optionalParameters[i], null, 2) : optionalParameters[i];
        message += `${message ? ' ' : ''}${msg}`;
      }
      return message;
    },
    // @ts-ignore
    log: (...optionalParameters) => {
      // @ts-ignore
      if (optionalParameters.length < 1 || this.logConfig[optionalParameters[1]] !== false) {
        if (this.logger) {
          this.logger.info(this.app.logMessage(...optionalParameters));
        } else {
          console.info(this.datetime(), this.memoryUsage(), ...optionalParameters);
        }
      }
    },
    // @ts-ignore
    errorEx: (...optionalParameters) => {
      if (this.logger) {
        this.logger.error(this.app.logMessage(...optionalParameters));
      } else {
        console.error(this.datetime(), this.memoryUsage(), ...optionalParameters);
      }
    }
  };

  constructor() {
    super();
    this.pluginName = process.argv[1].replace(path.extname(process.argv[1]), '.json');
    if (fs.existsSync(this.pluginName)) {
      this.pluginTemplate = eval(`require('${this.pluginName}')`);
    } else {
      this.pluginTemplate = {module: this.id};
    }
  }

  get loadConfig() {
    return false;
  }

  get id() {
    return `driver-${process.argv[2]}`;
  }

  get device_id() {
    return parseInt(process.argv[2]);
  }

  get statusKeys(): any {
    return {
      counter: {interval: 15000, max_interval: 15000},
      voltage: {interval: 15000},
      amperage: {interval: 15000},
      power_usage: {interval: 15000},
      power_load: {interval: 15000, max_interval: 15000},
      temperature: {interval: 15000},
      humidity: {interval: 15000},
      co2: {interval: 15000},
      voc: {interval: 15000},
      sound_level: {interval: 15000},
      illuminance: {interval: 15000},
      motion: {},
      motion_value: {interval: 60000000, min_interval: 60000000},
    };
  }

  datetime() {
    return moment(new Date()).format('HH:mm:ss');
  }

  updateEvents() {
    this.events.push({
      name: 'init-device',
      method: this.initDevice.bind(this)
    });
    this.events.push({
      name: 'connect-device',
      method: this.connect.bind(this)
    });
    this.events.push({
      name: 'delete-device',
      method: this.deleteDevice.bind(this)
    });
    this.events.push({
      name: 'device-command',
      method: this.command.bind(this)
    });
    this.events.push({
      name: 'device-sub-devices',
      method: this.subDevices.bind(this)
    });
  }

  templatesPath(ident: any, name: any = null) {
    return path.join(__dirname, '../', '../', 'templates', ident, name ? name : '');
  }

  applicationPath(root: any, needRoot = false) {
    let length = 0;
    switch (__dirname.split(path.sep).pop()) {
      case 'dist':
        length++;
        break;
      case 'core':
        length += needRoot ? 2 : -1;
        break;
    }
    length += root.split(path.sep).length - __dirname.split(path.sep).length;
    if (length < 0) {
      length = 0;
    }
    let result = needRoot ? path.join(root, '../'.repeat(length)) : '../'.repeat(length);
    if (__dirname.split(path.sep).pop() === 'core') {
      // result = `./${result}`;
    }
    return result;
  }

  loadTemplate(ident: any, name: any, options: any = null) {
    const path1 = path.join(process.cwd(), 'templates', ident, name ? name : '');
    try {
      if (options) {
        return name ? eval(`require('${path1}')`)(options) : null;
      } else {
        return name ? eval(`require('${path1}')`) : null;
      }
    } catch (e) {
      console.error(`${path1} ${process.cwd()}`);
      throw e;
    }
  }

  initDevice(params: any) {
    if (params.log_path && fs.existsSync(params.log_path)) {
      const logModuleName = `${params.log_path}/${this.pluginTemplate.module}-${this.id}.log`;
      if (!this.logger) {
        this.logger = winston.createLogger({
          transports: [new winston.transports.File({
            format: winston.format.simple(),
            filename: logModuleName,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5
          })]
        });
      }
    }

    if (this.logging) {
      this.log('initDevice-try', params);
    }
    return new Promise((resolve, reject) => {
      this.params = params && params.params ? params.params : {};
      this.environment = params ? params.environment : {};
      this.server_id = params ? params.server_id : '';
      this.cloud = params ? params.cloud : false;
      this.ident = params ? params.ident : null;
      this.apppath = params ? params.path : null;
      this.initDeviceEx(() => {
        if (this.logging) {
          this.log('initDevice-done');
        }
        this.ipc.of.app.emit('init-device', {id: params.id});
        resolve({});
      }, (error: any) => {
        this.ipc.of.app.emit('init-device', {id: params.id, error});
        reject(error);
      });
    });
  }

  connect(params: any) {
    if (this.logging) {
      this.log('connect-try', params);
    }
    return new Promise((resolve, reject) => {
      this.connectEx(() => {
        if (this.logging) {
          this.log('connect-done');
        }
        this.ipc.of.app.emit('connect-device', {id: params.id});
        resolve({});
      }, (error: any) => {
        this.ipc.of.app.emit('connect-device', {id: params.id, error});
        reject(error);
      });
    });
  }

  deleteDevice(params: any) {

  }

  command(params: any) {
    if (this.logging) {
      this.log('command-try', typeof params === 'object' ? JSON.stringify(params) : params);
    }
    return new Promise((resolve, reject) => {
      this.commandEx(params.command, params.value, params.params, params.options, (result: any) => {
        if (this.logging) {
          this.log('command-done', result);
        }
        this.ipc.of.app.emit('device-command', {id: params.id, result});
        resolve(result);
      }, (error: any) => {
        try {
          console.error('ERROR: device-command', params ? params.command : '', JSON.stringify(error));
        } catch (e) {
          console.error('ERROR: device-command', params ? params.command : '', error);
        }
        this.ipc.of.app.emit('device-command', {
          id: params.id,
          error: {ignore: error ? error.ignore : false, message: error ? error.message : ''}
        });
        reject(error);
      }, params.status);
    });
  }

  subDevices(params: any) {
    return new Promise((resolve, reject) => {
      this.getSubDevicesEx((result: any) => {
        this.ipc.of.app.emit('device-sub-devices', {id: params.id, result});
        resolve(result);
      }, (error: any) => {
        console.error('ERROR: device-sub-devices', params ? JSON.stringify(params) : '', error);
        this.ipc.of.app.emit('device-sub-devices', {id: params.id, error: {message: error.message}});
        reject(error);
      }, params.zones);
    });
  }

  initDeviceEx(resolve: any, reject: any) {
    resolve();
  }

  commandEx(command: any, value: any, params: any, options: any, resolve: any, reject: any, status: any) {
    resolve({});
  }

  connectEx(resolve: any, reject: any) {
    resolve({});
  }

  getSubDevicesEx(resolve: any, reject: any, zones: any) {
    resolve({});
  }

  startQueue(ident: any) {
    console.log('startQueue', ident)
    this.queue[ident] = {
      items: 0,
      iterator: 0,
      errors: 0,
    };
  }

  countQueue(ident: any) {
    this.queue[ident].items++;
  }

  doneQueue(ident: any, resolve: any, reject: any, inc = 1, error: any = null) {
    this.queue[ident].iterator += inc;
    console.log('doneQueue', ident, this.queue[ident].iterator, this.queue[ident].items, error)
    if (error && !this.queue[ident].errors) {
      console.log(error);
      this.queue[ident].errors++;
      reject(error);
    } else if (!this.queue[ident].errors && this.queue[ident].iterator === this.queue[ident].items) {
      resolve({});
    }
  }

  checkSubDevice(model: any, key: any, name: any, params: any, zone_id: any = null) {
    return this.request('check-sub-device', {model, key, name, params, zone_id, device_id: process.argv[2]});
  }

  publish(eventType: EventTypes, ...optionalParams: any[]) {
    this.requestEx('publish', {eventType, optionalParams});
  }

  publishStatus(eventType: EventTypes, status: any) {
    if (!this.statusCache[eventType]) {
      this.statusCache[eventType] = {status: {}, timestamps: {}};
    }
    if (status && typeof status === 'object') {
      const timestamp = new Date().getTime();
      const keys = Object.keys(status);
      let send = false;
      keys.forEach(key => {
        const key1 = key !== 'motion_value' ? key.split('_').slice(0, -1).join('_') : key;
        const needSend = () => {
          send = true;
          this.statusCache[eventType]['status'][key] = status[key];
          this.statusCache[eventType]['timestamps'][key] = timestamp;
        };
        const diff = this.statusCache[eventType]['timestamps'][key] ? timestamp - this.statusCache[eventType]['timestamps'][key] : 60000;
        let changed = typeof status[key] === 'object' ?
          JSON.stringify(status[key]) !== JSON.stringify(this.statusCache[eventType]['status'][key]) :
          status[key] !== this.statusCache[eventType]['status'][key];
        const status_key = this.statusKeys[key1];
        const max_interval = status_key && status_key.max_interval ? status_key.max_interval : 60000;
        if (key1 === 'motion' && changed && !status[key] && this.statusCache[eventType]['status'][key] &&
          timestamp - this.statusCache[eventType]['timestamps'][key] < 15000) {
          changed = false;
        }
        if (changed || diff >= 60000) {
          if (typeof status[key] === 'number' && this.statusCache[eventType]['status'][key] && diff < max_interval) {
            const percent = Math.abs(100 - status[key] * 100 / this.statusCache[eventType]['status'][key]);
            const min_percent = status_key && status_key.min_percent ? status_key.min_percent : 1;
            const max_percent = status_key && status_key.max_percent ? status_key.max_percent : 10;
            const interval = status_key && status_key.interval ? status_key.interval : 15000;
            const min_interval = status_key && status_key.min_interval ? status_key.min_interval : 3000;
            if ((percent > min_percent && diff >= interval) || (percent > max_percent && diff > min_interval)) {
              needSend();
            }
          } else {
            needSend();
          }
        }
      });
      if (send) {
        const result: any = {};
        Object.keys(this.statusCache[eventType]['status']).forEach(key => {
          if (this.statusCache[eventType]['timestamps'][key] === timestamp) {
            result[key] = this.statusCache[eventType]['status'][key];
            if (key === 'motion' && status['motion_value']) {
              result['motion_value'] = status['motion_value'];
            }
          }
        });
        this.publish(eventType, result);
      }
    }
  }

  eventTypeStatus(className: any, identifier: any = null, key: any = null) {
    return `status->${className}${identifier ? `->${identifier}` : ''}${key ? `->${key}` : ''}`;
  }

  sendNotify(message: any) {
    this.requestEx('notify', {message});
  }

  sendPushNotification(message: any, email: any) {
    this.requestEx('send-notification', {message, email});
  }

  getDevices(params = {}) {
    return this.request('application->getDevices', params);
  }

  getDeviceCustomData(ident: string, custom_data_id: any) {
    return this.request('application->getDeviceCustomData', {ident, custom_data_id});
  }

  options(options: any) {
    const include = (options: any) => {
      if (options.include) {
        options.include.forEach((incl: any) => {
          incl.model = incl.model.tableName;
          include(incl);
        });
      }
      if (options.where) {
        Object.keys(options.where).forEach(key => {
          if (options.where[key] && typeof options.where[key] === 'object' && !Array.isArray(options.where[key])) {
            const check = (key1: any, key2: string) => {
              if (options.where[key][key1]) {
                options.where[key][key2] = options.where[key][key1];
                delete options.where[key][key1];
              }
            };
            check(Symbol.for('gt'), '>');
          }
        });
      }
    };
    include(options);
  }

  getTable(table: string, options: any) {
    this.options(options);
    return this.request('application->getTable', {table, options});
  }

  createTable(table: string, options: any) {
    this.options(options);
    return this.request('application->createTable', {table, options});
  }

  updateTable(table: string, options: any, where: any) {
    this.options(options);
    return this.request('application->updateTable', {table, options, where});
  }

  deviceCommand(ident: any, command: any, data: any) {
    return this.request('application->deviceCommand', {ident, command, data});
  }

  deviceEvent(ident: string, event: string, data: any) {
    return this.request('application->deviceEvent', {ident, event, data});
  }

  subscribeDevice(ident: string, event: any) {
    return this.request('application->subscribeDevice', {parent_id: this.device_id, ident, event});
  }

  memoryUsage() {
    const time = new Date().getTime();
    if (!this.lastMemoryUsage || time - this.lastMemoryUsageTime >= 1000) {
      this.lastMemoryUsage = process.memoryUsage();
      this.lastMemoryUsageTime = time;
    }
    const formatMem = (ident: any) => {
      return `${ident}: ${Math.round(this.lastMemoryUsage[ident] / 1024 / 1024 * 100) / 100}MB`;
    };

    return `${formatMem('rss')};`;
  }

  log(...optionalParameters: any) {
    this.app.log(...optionalParameters);
  }

  error(...optionalParameters: any) {
    this.app.errorEx(...optionalParameters);
  }

  request(eventName: any, params = {}) {
    if (this.logging) {
      this.log('request', eventName, typeof params === 'object' ? JSON.stringify(params) : params);
    }
    return super.request(eventName, params);
  }

  requestEx(eventName: any, params = {}) {
    if (this.logging) {
      this.log('requestEx', eventName, typeof params === 'object' ? JSON.stringify(params) : params);
    }
    return super.requestEx(eventName, params);
  }

});