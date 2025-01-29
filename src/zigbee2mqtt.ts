import {baseDriverModule} from '../core/base-driver-module';
import {inspect} from 'util';
import * as fs from 'fs';
import {ColorConverter} from '../lib/color-converter';

const moment = require('moment');

class Zigbee2mqtt extends baseDriverModule {
  mqtt: any;
  coordinators: any[] = [];
  converters: any;
  logCapability: any[] = [];
  devices: any[] = [];
  availability: any[] = [];
  capabilities: any[] = [];
  lastDevicesTimeout: any;
  lastDevices: any;
  lastDevicesWorking: any;
  availabilityTimeout: any;

  initDeviceEx(resolve: any, reject: any) {
    if (this.logging) {
      this.log('initDeviceEx-try', this.params);
    }

    if (this.device) {
      this.app.log('initDeviceEx already done');
      return resolve({});
    }

    super.initDeviceEx(() => {
      this.capabilities = [];
      this.capabilities.push({
        ident: 'power',
        display_name: 'Add Zigbee device',
        options: {link_devices: true}
      });
      this.capabilities.push({ident: 'push_button', index: '2', display_name: 'Refresh network map'});
      // result['capabilities'].push({ident: 'push_button', index: '2', display_name: 'Exclude device'});
      this.capabilities.push({ident: 'text', index: '1', display_name: 'Online devices'});
      this.capabilities.push({ident: 'text', index: '2', display_name: 'Offline devices'});
      this.capabilities.push({ident: 'image', index: '1'});

      let settings: any;

      try {
        settings = require('../lib/zigbee2mqtt/util/settings');
      } catch (e: unknown) {
        this.app.errorEx(e);

        if (e instanceof Error) {
          throw new Error(e.message);
        }
      }

      try {
        this.converters = require('zigbee-herdsman-converters');
      } catch (e) {
        this.app.errorEx(e);
      }

      let config: any;

      try {
        config = settings.get();
      } catch (e) {
        const data = require('../lib/zigbee2mqtt/util/data');
        const file = data.default.joinPath('configuration.yaml');

        try {
          fs.mkdirSync(data.default.joinPath(''), {});
        } catch (e) { }

        fs.writeFileSync(file, 'homeassistant: false');

        settings.set(['permit_join'], false);
        // settings.set(['homeassistant'], false);
        settings.set(['frontend'], true);
        settings.set(['mqtt', 'base_topic'], 'zigbee2mqtt');
        settings.set(['mqtt', 'server'], 'mqtt://localhost');

        if (this.params.port) {
          if (this.logging) {
            this.log('initDeviceEx-try', 'checkpoint set port', this.params.port);
          }

          settings.set(['serial', 'port'], this.params.port);
          const adapter = this.getAdapterByPort(this.params.port);
          
          if (adapter) {
            settings.set(['serial', 'adapter'], adapter);
          }
        } else {
          settings.set(['serial', 'port'], '/dev/ttyUSB0');
        }

        config = settings.get();
      }

      if (!config.advanced || config.advanced.last_seen !== 'epoch') {
        settings.set(['advanced', 'last_seen'], 'epoch');
      }
      if (!config.advanced || !config.advanced.availability_timeout) {
        settings.set(['advanced', 'availability_timeout'], 1200);
      }

      const check = (param: string, value: any, arr: string[], number: boolean | undefined = undefined, array: boolean | undefined = undefined, force = false) => {
        if (this.params[param] || force) {
          let value1: any;
          if (value !== undefined) {
            value1 = value;
          } else {
            value1 = this.params[param];
          }
          const value2 = arr.length === 1 ? config[arr[0]] : config[arr[0]][arr[1]];
          if (array) {
            value1 = value1.replace(/\s/g, '');
            value1 = value1.split(',')
            if (number) {
              value1 = value1.map((item: any) => parseInt(item))
            }
          } else if (number) {
            value1 = parseInt(value1)
          }
          if (value1 !== value2) {
            this.app.log(param, 'diff', value1, value2, typeof value1);
            settings.set(arr, value1);
          } else {
            this.app.log(param, 'same', value1, value2);
          }
        } else {
          this.app.log(`Parameter ${param} is not defined`)
        }
      };

      if (!this.params.permit_join) {
        this.params.permit_join = false;
      }

      check('permit_join', undefined, ['permit_join'], undefined, undefined, true);
      check('port', undefined, ['serial', 'port']);
      check('adapter', undefined, ['serial', 'adapter']);
      check('pan_id', undefined, ['advanced', 'pan_id'], true);
      check('ext_pan_id', undefined, ['advanced', 'ext_pan_id'], true, true);
      check('network_key', undefined, ['advanced', 'network_key'], true, true);
      check('channel', undefined, ['advanced', 'channel'], true);
      check('mqtt_address', `mqtt://${this.params.mqtt_address}`, ['mqtt', 'server']);
      check('mqtt_user', this.params.mqtt_user ? this.params.mqtt_user : 'mqtt-user', ['mqtt', 'user'], undefined, undefined, true);
      check('mqtt_password', this.params.mqtt_password ? this.params.mqtt_password : 'mqtt-pass', ['mqtt', 'password'], undefined, undefined, true);

      try {
        const data = require('../lib/zigbee2mqtt/util/data');
        this.app.log(data.default.joinPath('configuration.yaml'));
        this.app.log(JSON.stringify(config, null, 2));
      } catch (e) {
        this.app.errorEx(e);
      }

      try {
        this.app.log('Loading controller');
        const Controller = require('../lib/zigbee2mqtt/controller');
        this.app.log('Creating controller');
        this.device = new Controller(() => {
          process.exit();
        }, () => {
          process.exit();
        });
        this.app.log('Done controller');
      } catch (e) {
        this.app.errorEx(e);
        reject(e);
      }
      resolve({});
    }, reject);
  }

  connectEx(resolve1: any, reject1: any) {
    if (this.mqtt) {
      this.app.log('connectEx already done');
      if (this.mqtt.connected) {
        return resolve1({});
      } else {
        return reject1({});
      }
    }

    let done = false;
    const resolve = (data: any) => {
      if (!done) {
        done = true;
        resolve1(data);
      }
    };
    const reject = (error: any) => {
      if (!done) {
        done = true;
        reject1(error);
      }
    };

    const start = () => {
      if (this.params.port) {
        try {
          this.device.start().then(() => {
            this.updateState(resolve, reject);
          }).catch((error: any) => {
            console.log(error);
            this.sendNotify(`Zigbee: ${error.message}`);
            reject(error);
          });
        } catch (e) {
          this.app.errorEx(e);
          reject(e);
        }
      } else {
        return this.updateState(resolve, reject);
      }
    };

    const mqtt = require('mqtt');

    const timeout = setTimeout(() => {
      this.sendNotify('Zigbee: mosquitto server is unavailable');
      reject({ignore: true});
      setTimeout(() => {
        process.exit();
      }, 1000);
    }, 10000);
    const options: any = {};
    if (this.params.mqtt_user && this.params.mqtt_password) {
      options['username'] = this.params.mqtt_user;
      options['password'] = this.params.mqtt_password;
    }
    this.mqtt = mqtt.connect(`mqtt://${this.params.mqtt_address}`, options);
    this.mqtt.on('connect', () => {
      this.mqtt.on('disconnect', () => {
        this.disconnected();
      });
      this.mqtt.on('message', (topic: any, message: any) => {
        this.message(topic, message.toString());
      });
      this.mqtt.subscribe('zigbee2mqtt/#', (error: any) => {
        if (error) {
          this.app.errorEx(error);
        }
      });

      clearTimeout(timeout);
      this.connected();
      start();
    });
  }

  sort() {
    this.capabilities.sort((a, b) => {
      if (a.ident === 'power' && !a.index) {
        return a.ident === 'power' && !a.index ? -1 : 1;
      } else if (b.ident === 'power' && !b.index) {
        return b.ident === 'power' && !b.index ? 1 : -1;
      } else if (a.ident === 'image') {
        return a.ident === 'image' ? -1 : 1;
      } else if (b.ident === 'image') {
        return b.ident === 'image' ? 1 : -1;
      } else if (a.ident === 'push_button') {
        return a.ident === 'push_button' ? -1 : 1;
      } else if (b.ident === 'push_button') {
        return b.ident === 'push_button' ? 1 : -1;
      } else if (a.ident === 'text' && b.ident === 'text') {
        return a.index.localeCompare(b.index);
      } else if (a.ident === 'text') {
        return a.ident === 'text' ? -1 : 1;
      } else if (b.ident === 'text') {
        return b.ident === 'text' ? 1 : -1;
      } else {
        const titleA = `${a.zone_name} (${a.display_name})`;
        const titleB = `${b.zone_name} (${b.display_name})`;
        return titleA.localeCompare(titleB);
      }
    });
  }

  commandEx(command: any, value: any, params: any, options1: any, resolve: any, reject: any) {
    switch (command) {
      case 'pair_mode':
        this.mqttPublish('zigbee2mqtt/bridge/request/permit_join', 'true');
        resolve({});
        break;
      case 'update_settings':
        resolve({});
        break;
      case 'settings':
        this.sort();
        resolve({capabilities: this.capabilities});
        break;
      default:
        const device = this.devices.find((item) => item.identifier === params.identifier);
        if (device) {
          const capability = device.capabilities.find((item: any) => `${item.ident}_${item.index}` === command);
          if (capability) {
            let exists = true;
            const options: any = {};
            const pub = () => {
              const identifier = params.parent_identifier ? params.parent_identifier : params.identifier;
              this.mqttPublish(`zigbee2mqtt/${identifier}/set`, options);
              setTimeout(() => {
                Object.keys(options).forEach(key => {
                  options[key] = '';
                })
                this.mqttPublish(`zigbee2mqtt/${identifier}/get`, options);
              }, 1000);
            };
            if (capability.composite) {
              exists = false;
              this.getDevices({currentStatus: true}).then((devices: any) => {
                const device1 = devices.find((item1: any) => item1.params.identifier === params.identifier);
                if (device1) {
                  options[capability.composite] = {};
                  device.capabilities.forEach((capability1: any) => {
                    if (capability1.composite === capability.composite) {
                      options[capability.composite][capability1.property] = device1.currentStatus[`${capability1.ident}_${capability1.index}`]
                    }
                  });
                }
                options[capability.composite][capability.property] = value;
                pub();
              })
            } else {
              switch (capability.ident) {
                case 'power':
                  options[capability.property] = value ? capability.value_on : capability.value_off;
                  break;
                case 'rgb':
                  if (capability.color_xy === true) {
                    options[capability.property] = ColorConverter.rgbToXy(value.red, value.green, value.blue);
                  }
                  break;
                default:
                  options[capability.property] = value;
                // exists = false;
                // reject({message: `Capability ${command} to device ${params.identifier} not found`});
              }
            }
            if (exists) {
              pub();
            }
            resolve({});
          } else {
            reject({message: `Capability ${command} to device ${params.identifier} not found`});
          }
        } else if (!params.identifier) {
          switch (command) {
            case 'power':
              const enableTitle = 'Zigbee: контроллер переведен в режим сопряжения. Воспользуйтесь инструкцией к добавляемому устройству'
              const disableTitle = 'Zigbee: режим сопряжения контроллера отключен.'
              this.sendNotify(value ? enableTitle : disableTitle);
              this.mqttPublish('zigbee2mqtt/bridge/request/permit_join', value ? 'true' : false);
              if (value) {
                clearTimeout(this.cancelControllerCommandTimeout);
                this.cancelControllerCommandTimeout = setTimeout(() => {
                  this.sendNotify(disableTitle);
                  this.mqttPublish('zigbee2mqtt/bridge/request/permit_join', 'false');
                  this.publish(this.eventTypeStatus(this.pluginTemplate.class_name, this.id), {power: false});
                }, 60000);
              }
              this.publish(this.eventTypeStatus(this.pluginTemplate.class_name, this.id), {power: value});
              resolve({});
              break;
            case 'push_button_2':
              this.sendNotify('Zigbee: updating network map, please wait few minutes');
              this.mqttPublish('zigbee2mqtt/bridge/request/networkmap', '{"type":"graphviz", "routes":true}');
              resolve({});
              break;
          }
        } else {
          reject({message: `Device ${params.identifier} not found`, repeat: false});
        }
    }
  }

  connected() {
    this.app.log('mqtt connected')
  }

  disconnected() {
    this.app.log('mqtt disconnected')
  }

  mqttPublish(topic: any, value: any) {
    this.log('publish', topic, typeof value === 'object' ? JSON.stringify(value) : value);
    this.mqtt.publish(topic, typeof value === 'object' ? JSON.stringify(value) : value);
  }

  updateState(resolve: any, reject: any) {
    this.mqttPublish('zigbee2mqtt/bridge/config/devices/get', null);
    if (resolve) {
      resolve({});
    }
  }

  message(topic: any, message: any) {
    // this.log('message', topic, message);
    const params = topic.split('/');
    if (params && params.length > 1) {
      let ident: any;
      let type: any;
      let body: any;
      let check = true;
      const parse = (result: any, params: any, ident = '') => {
        Object.keys(params).forEach((key) => {
          const newKey = `${ident}${ident ? '/' : ''}${key}`;
          if (params[key] && typeof params[key] === 'object') {
            parse(result, params[key], newKey);
          } else {
            result[newKey] = params[key];
          }
        });
      };
      if (message.indexOf('{') === 0 || message.indexOf('[') === 0) {
        try {
          body = JSON.parse(message);
        } catch (e) {
        }
      }
      if (params[0] === 'zigbee2mqtt') {
        ident = params[1];
        type = 'zigbee2mqtt';
        check = false;
        if (body && body.last_seen) {
          const status1: any = {};
          const date = new Date(body.last_seen);
          const sameDay = new Date().toDateString() === date.toDateString();
          status1[`info_${ident}`] = `Last seen: ${moment(date).format(`${sameDay ? '' : 'DD.MM.YYYY '}HH:mm:ss`)}`;
          this.publish(this.eventTypeStatus(this.pluginTemplate.class_name, this.id), status1);
        }
        if (params[2] === 'availability' && (!body || body.state)) {
          body = {availability: !body ? message : body.state};
          let device = this.availability.find((item) => item.ident === ident);
          if (!device) {
            device = {ident, online: body.availability === 'online'};
            this.availability.push(device);
          } else {
            device.online = body.availability === 'online';
          }
          const update = () => {
            const status: any = {
              text_1: this.availability.filter((item) => item.online).length,
              text_2: this.availability.filter((item) => !item.online).length,
              capabilities: this.capabilities,
            };
            this.availability.forEach((availability, index) => {
              let cap = this.capabilities.find((item) => item.identifier === availability.ident);
              const dev = this.lastDevices.find((item: any) => item.params ? (item.params.identifier === availability.ident && `driver-${item.params.parent_id}` === this.id) : null);
              if (!cap) {
                cap = {
                  ident: 'power',
                  index: index + 1,
                  identifier: availability.ident,
                  options: {read_only: true, power_on_button_title: 'online', power_off_button_title: 'offline', info: `info_${availability.ident}`},
                  zone_name: dev ? dev.zone_name : '',
                  online: availability.online,
                  display_name: '',
                };
                if (dev) {
                  cap.display_name = `${dev.name}${dev.name && dev.name.indexOf(availability.ident) === -1 ? ` [${availability.ident}]` : ''}${dev.zone_name ? ` (${dev.zone_name})` : ''}`
                } else {
                  cap.display_name = availability.ident;
                }
                this.capabilities.push(cap);
              }
              status[`power_${index + 1}`] = availability.online;
            });
            this.sort();
            // clearTimeout(this.availabilityTimeout);
            // this.availabilityTimeout = setTimeout(() => {
            this.publish(this.eventTypeStatus(this.pluginTemplate.class_name, this.id), status);
            // }, 1000);
          };
          if (!this.lastDevicesTimeout || new Date().getTime() - this.lastDevicesTimeout > 60000) {
            if (!this.lastDevicesWorking) {
              this.lastDevicesWorking = true;
              this.getDevices().then((appDevices: any) => {
                this.lastDevicesWorking = false;
                this.lastDevicesTimeout = new Date().getTime();
                this.lastDevices = appDevices;
                update();
              });
            }
          } else {
            update();
          }
          this.publish(this.eventTypeStatus(this.pluginTemplate.class_name, ident),
            {connected: body.availability === 'online'});
        }
        if (topic === 'zigbee2mqtt/bridge/config/devices' ||
          topic === 'zigbee2mqtt/bridge/devices') {
          this.parseDevices(body);
        } else if (topic === 'zigbee2mqtt/bridge/response/networkmap') {
          this.sendNotify('Zigbee: network map updated!');
          this.require('viz.js').then((Viz: any) => {
            this.require('viz.js/full.render').then((fullRender: any) => {
              try {
                const Module = fullRender.Module;
                const render = fullRender.render;
                let viz = new Viz({Module, render});

                const replaceAll = (str: string, find: string, replace: string) => {
                  return str.replace(new RegExp(find, 'g'), replace);
                }

                const graphVizToImgBuffer = (graph: string) => {
                  return new Promise((resolve, reject) => {
                    this.app.log('viz.renderString');
                    viz.renderString(graph, {engine: 'fdp'}).then((result: string) => {
                      resolve(result);
                    }).catch((error: any) => {
                      reject(error)
                    });
                  })
                }

                message = JSON.parse(message)
                let graph = message['data']['value']
                graph = replaceAll(graph, '\'', '"');

                this.capabilities.forEach(capability => {
                  if (capability.identifier) {
                    // this.app.log('graph.before', capability.identifier, capability.display_name, graph);
                    graph = graph.replace(`${capability.identifier}|${capability.identifier}`, `${capability.display_name}|${capability.identifier}`);
                    // this.app.log('graph.after', graph);
                  }
                });

                graphVizToImgBuffer(graph).then((buffer: unknown) => {
                  let b64 = Buffer.from(buffer as string).toString('base64');
                  // fs.writeFileSync("test.png", b64, 'base64')
                  // const device = this.devices.find((item) => item.identifier === ident);
                  // if (device) {
                  //   this.statusEventName = this.eventTypeStatus(device.class_name, `driver-${device.id}`)
                  // } else {
                  this.statusEventName = this.eventTypeStatus(this.pluginTemplate.class_name, this.id);
                  // }
                  this.app.log('publish network_map');
                  this.publish(this.statusEventName, {image_1: `data:image/svg+xml;base64,${b64}`});
                }).catch(e => {
                  this.app.errorEx(e);
                })

                this.app.log('network_map', message);
              } catch (e) {
                this.app.errorEx(e);
              }
            })
          });

        } else if (ident === 'bridge' && params.length > 2 && (params[2] === 'log' || params[2] === 'event')) {
          this.bridgeLog(JSON.parse(message));
        }
        ident = params[1];
        const device = this.devices.find((item) => item.identifier === ident);
        if (device) {
          const setProp = (status: any, capability: any) => {
            if (body[capability.property] !== undefined) {
              if (capability.value_on !== undefined && capability.value_off !== undefined) {
                if (body[capability.property] === capability.value_on) {
                  status[`${capability.ident}_${capability.index}`] = true;
                } else if (body[capability.property] === capability.value_off) {
                  status[`${capability.ident}_${capability.index}`] = false;
                }
                return true;
              } else if (capability.color_xy === true && body[capability.property]) {
                status[`${capability.ident}_${capability.index}`] = ColorConverter.xyBriToRgb(body[capability.property].x, body[capability.property].y, body.brightness);
              } else {
                status[`${capability.ident}_${capability.index}`] = body[capability.property];
                return true;
              }
            } else {
              return false;
            }
          }
          const status: any = {};
          device.capabilities.forEach((capability: any) => {
            setProp(status, capability);
          });
          const deviceStatus = this.availability.find((item) => item.ident === ident);
          if (deviceStatus) {
            status['connected'] = deviceStatus.online;
          }
          this.publish(this.eventTypeStatus(this.pluginTemplate.class_name, ident), status);
          const children = this.devices.filter(item => item.parent_identifier === ident);
          if (children.length) {
            children.forEach(child => {
              let found = false;
              const status1: any = {};
              child.capabilities.forEach((cap: any) => {
                if (setProp(status1, cap)) {
                  found = true;
                  if (deviceStatus) {
                    status1['connected'] = deviceStatus.online;
                  }
                }
              });
              if (found) {
                this.publish(this.eventTypeStatus(this.pluginTemplate.class_name, child.identifier), status1);
              }
            })
          }
        }
      }
      // this.app.log(`${topic} ${message}`, 'device', 'message', type ? type : 'unknown');
      // if (type && body) {
      //   this.onDeviceMessage(ident, body, {check});
      // } else {
      //   this.app.publish(EventTypes.MqttMessage, topic, message);
      // }
    }
  }

  bridgeLog(payload: any) {
    this.app.log('bridgeLog', payload);
    let msg = '';
    switch (payload.type) {
      // case 'pairing':
      //   switch (payload.message) {
      //     case 'interview_successful':
      //       ident = payload.meta.friendly_name;
      //       if (!this.devices[ident]) {
      //         this.onDeviceMessageNewDevice(ident);
      //       }
      //       this.devices[ident].name = `${payload.meta.description} (${ident})`;
      //       break;
      //   }
      //   break;
      case 'device_announce':
      case 'device_announced':
        // msg = `Device ${payload.message.friendly_name} announced`;
        break;
      case 'device_connected':
        msg = `Device ${payload.message.friendly_name} connected`;
        break;
      case 'device_leave':
        msg = `Device ${payload.data ? payload.data.friendly_name : ''} leave`;
        break;
      case 'device_interview':
        msg = `Device ${payload.data ? payload.data.friendly_name : ''} interview`;
        break;
      case 'device_force_removed':
        msg = `Device ${payload.message} force removed`;
        break;
      case 'device_removed_failed':
        msg = `Device ${payload.message} remove failed`;
        this.mqttPublish('zigbee2mqtt/bridge/config/force_remove', payload.message);
        break;
      case 'device_removed':
        switch (payload.message) {
          case 'left_network':
            msg = `Device ${payload.meta.friendly_name} removed`;
            const topic = `zigbee2mqtt/${payload.meta.friendly_name}`;
            this.log('publish', topic, null, {retain: true});
            this.mqtt.publish(topic, null, {retain: true});
            const index = this.devices.findIndex((item) => item.identifier === payload.meta.friendly_name);
            this.log('findIndex', index);
            if (index !== -1) {
              this.devices.splice(index, 1);
            }
            break;
          default:
            this.app.log(payload.message);
        }
        break;
      case 'pairing':
        switch (payload.message) {
          case 'interview_failed':
          case 'interview_started':
          case 'interview_successful':
            const msg1 = payload.message.split('_').join(' ');
            msg = `Device ${msg1}`;
            if (payload.message === 'interview_successful') {
              this.updateState(null, null);
            }
            break;
          default:
            this.app.log(payload.message);
        }
        break;
      case 'devices':
        break;
      case 'zigbee_publish_error':
        // let device_id = null;
        // if (payload.meta && payload.meta.friendly_name) {
        //   Object.keys(this.app.devices).forEach(key => {
        //     if (this.app.devices[key].getParam('parent_id') === this.dbDevice.id && this.app.devices[key].getParam('identifier') === payload.meta.friendly_name) {
        //       device_id = this.app.devices[key].dbDevice.id;
        //     }
        //   });
        // }
        // this.emit('new-event', payload.message, 'zigbee_publish_error', this.app._models.events.kinds.KIND_ERROR,
        //   null, payload.message, device_id);
        break;
      default:
        this.app.log(payload);
    }
    if (msg) {
      this.sendNotify(msg);
    }
  }

  async parseDevices(body: any) {
    if (body && body.length) {
      const coordinator = body.find((item: any) => item.type === 'Coordinator');
      if (coordinator) {
        const coordinator1 = this.coordinators.find((item) => item.ieeeAddr === coordinator.ieeeAddr);
        if (!coordinator1) {
          this.coordinators.push({ieeeAddr: coordinator.ieeeAddr, devices: body});
        } else {
          coordinator1.devices = body;
        }
      }
      // const keys = Object.keys(this.app.drivers.drivers);
      body.forEach((device: any) => {
        const identifier = device.friendly_name ? device.friendly_name : device.ieeeAddr;
        let model = device.model ? device.model : (device.definition ? device.definition.model : null);
        if (identifier && model) {
          if (model === 'RR620ZB') {
            model = 'MG-ZG02W'
          }
          const devices = this.converters.devices ? this.converters.devices : this.converters.definitions;
          if (devices) {
            const deviceTemplate = devices.find((item: any) => item.model === model ||
              (item.whiteLabel && item.whiteLabel.find((item1: any) => item1.model === model)));
            this.parseDevice(identifier, device, deviceTemplate);
          }
        }
      });
    }
  }

  async parseDevice(identifier: any, device: any, deviceTemplate: any) {
    if (deviceTemplate) {
      let icon: string;
      const capabilities: any[] = [];
      const log = (type: any, feature: any, template: any) => {
        // const ident = `${type}_${feature.name}`;
        if (!this.logCapability.find((item) => item.type === type && item.name === feature.name)) {
          this.logCapability.push({
            type,
            name: feature.name,
            description: feature.description,
            unit: feature.unit,
            value_on: feature.value_on,
            value_off: feature.value_off,
            values: feature.values,
          });
        }
      };
      const setIcon = (value: any) => {
        const priority: any[] = [];
        let i1 = priority.findIndex((item) => item === value);
        let i2 = priority.findIndex((item) => item === icon);
        if (i1 === -1) {
          i1 = 999;
        }
        if (i2 === -1) {
          i2 = 999;
        }
        if (!icon || (i1 < i2)) {
          icon = value;
        }
      };
      const addFeature = (expose: any, feature: any, index: any) => {
        let ident;
        let display_name;
        let homekit;
        let yandex;
        let sber;
        const capability: any = {index, property: feature.property, access: feature.access};

        const setIdent = (ident1: any, icon1: any = null, display_name1: any = null) => {
          ident = ident1;
          if (icon1) {
            icon = icon1;
          }
          if (display_name1) {
            display_name = display_name1;
          } else if (feature.property) {
            display_name = feature.property.split('_').join(' ');
            if (display_name.length) {
              display_name = display_name.charAt(0).toUpperCase() + display_name.slice(1);
            }
          }
          if (expose.type === 'composite') {
            capability.composite = expose.property;
          }
          switch (ident) {
            case 'magnet':
            case 'motion':
            case 'power':
              if (feature.value_on !== undefined && feature.value_off !== undefined) {
                capability.value_on = feature.value_on;
                capability.value_off = feature.value_off;
              } else if (feature.type === 'enum' && feature.values && feature.values.length > 1) {
                capability.value_on = feature.values[0];
                capability.value_off = feature.values[1];
              }
              break;
            case 'range':
              if (feature.access === 1) {
                ident = 'text';
              } else {
                // capability.value_min = feature.value_min;
                // capability.value_max = feature.value_max;
                capability.options = {minValue: feature.value_min, maxValue: feature.value_max};
                if (feature.value_step) {
                  capability.options.stepValue = feature.value_step;
                }
              }
              break;
            case 'mode':
              if (feature.access === 1) {
                ident = 'action';
              }
              break;
            case 'rgb':
              if (feature.features && feature.features[0] && feature.features[1] && feature.features[0].property === 'x' && feature.features[1].property === 'y') {
                capability.color_xy = true;
              }
              break;
          }
          switch (ident) {
            case 'illuminance':
              setIcon('multisensor');
              break;
            case 'leak':
              setIcon('leak');
              break;
            case 'smoke':
              setIcon('smoke');
              break;
            case 'magnet':
              setIcon('door_sensor');
              break;
            case 'motion':
              setIcon('motion');
              break;
            case 'power_usage':
            case 'power_load':
              setIcon('socket');
              break;
            case 'temperature':
              setIcon('temp_sensor');
              break;
          }
          switch (ident) {
            case 'mode':
              const modes: any = {};
              feature.values.forEach((value: any) => {
                modes[value] = {value, title: value};
              });
              if (!capability.options) {
                capability.options = {};
              }
              capability.options['modes'] = modes;
              break;
            case 'action':
              const actions: any[] = [];
              feature.values.forEach((value: any) => {
                actions.push({value, title: value});
              });
              if (!capability.options) {
                capability.options = {};
              }
              capability.options['actions'] = actions;
              capability.options['force'] = true;
              break;
          }
        };

        this.app.log(`Check TRY: ${expose.type}_${feature.name}`);
        switch (`${expose.type}_${feature.name}`) {
          case 'binary_alarm':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Turn the device automatically off when attached device consumes less than 2W for 20 minutes
          case 'binary_auto_off':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Indicates if the battery of this device is almost empty
          case 'binary_battery_low':
            setIdent('text');
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Enable buzzer feedback
          case 'binary_buzzer_feedback':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          case 'binary_calibration':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // The dimmer is capable of replacing the built-in, default dimming curve.
          case 'binary_capabilities_configurable_curve':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // The dimmer supports AC forward phase control.
          case 'binary_capabilities_forward_phase_control':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // The dimmer is capable of detecting an output overload and shutting the output off.
          case 'binary_capabilities_overload_detection':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // The dimmer is capable of measuring the reactanceto distinguish inductive and capacitive loads.
          case 'binary_capabilities_reactance_discriminator':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // The dimmer supports AC reverse phase control.
          case 'binary_capabilities_reverse_phase_control':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Indicates if CO (carbon monoxide) is detected
          case 'binary_carbon_monoxide':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Indicates whether device is physically attached. Device does not have to pull power or even be connected electrically (switch can be ON even if switch is OFF).
          case 'binary_consumer_connected':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Indicates if the contact is closed (= true) or open (= false)
          case 'binary_contact':
            setIdent('magnet');
            break;
          // Enable ABC (Automatic Baseline Correction)
          case 'binary_enable_abc':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Indicates whether the device detected gas
          case 'binary_gas':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          case 'binary_humidity_alarm':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Enabling prevents both relais being on at the same time
          case 'binary_interlock':
            setIdent('power');
            break;
          case 'binary_led':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Enable/disable the LED at night
          case 'binary_led_disabled_night':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Enabled LED
          case 'binary_led_enable':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Enable LED feedback
          case 'binary_led_feedback':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          case 'binary_led_state':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          case 'binary_motor_reversal':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          case 'binary_moving':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Indicates whether the device detected occupancy
          case 'binary_occupancy':
            setIdent('motion');
            break;
          // Enable PIR sensor
          case 'binary_pir_enable':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Enable/disable the power alarm
          case 'binary_power_alarm':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          case 'binary_power_alarm_active':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Enable/disable the power outage memory, this recovers the on/off mode after power failure
          case 'binary_power_outage_memory':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Indicates whether the device detected presence
          case 'binary_presence':
            setIdent('motion');
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Enabled reporting
          case 'binary_reporting_enable':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          case 'binary_reverse':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          case 'binary_running':
            setIdent('input');
            break;
          // Indicates whether the device detected smoke
          case 'binary_smoke':
            setIdent('smoke');
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // SOS alarm
          case 'binary_sos':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          case 'binary_state':
            setIdent('power');
            break;
          // The dimmer's reactance discriminator had detected a capacitive load.
          case 'binary_status_capacitive_load':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // The dimmer is currently operating in AC forward phase control mode.
          case 'binary_status_forward_phase_control':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // The dimmer's reactance discriminator had detected an inductive load.
          case 'binary_status_inductive_load':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // The output is currently turned off, because the dimmer has detected an overload.
          case 'binary_status_overload':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // The dimmer is currently operating in AC reverse phase control mode.
          case 'binary_status_reverse_phase_control':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Indicates whether the device is tampered
          case 'binary_tamper':
            setIdent('tamper');
            break;
          case 'binary_temperature_alarm':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Indicates whether the device detected vibration
          case 'binary_vibration':
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          // Indicates whether the device detected a water leak
          case 'binary_water_leak':
            setIdent('leak');
            break;
          case 'climate_away_mode':
            setIdent('power');
            break;
          case 'climate_current_heating_setpoint':
            setIdent('target_temperature', 'heater');
            break;
          case 'climate_local_temperature':
            setIdent('temperature');
            homekit = true;
            yandex = true;
            sber = true;
            break;
          case 'climate_local_temperature_calibration':
            setIdent('target_temperature');
            break;
          case 'climate_preset':
            setIdent('mode');
            break;
          case 'climate_running_state':
            setIdent('mode');
            break;
          case 'climate_system_mode':
            setIdent('mode');
            break;
          case 'composite_strobe':
            setIdent('power');
            break;
          case 'composite_duration':
            setIdent('range');
            break;
          case 'composite_mode':
            setIdent('mode');
            break;
          case 'composite_level':
            setIdent('mode');
            break;
          case 'composite_strobe_duty_cycle':
            setIdent('range');
            break;
          case 'composite_strobe_level':
            setIdent('mode');
            break;
          case 'composite_options':
            break;
          case 'composite_warning':
            break;
          // Position of this cover
          case 'cover_position':
            setIdent('range', 'view_column');
            break;
          case 'cover_state':
            setIdent('power', 'view_column');
            capability.options = {power_on_button_title: 'откр', power_off_button_title: 'закр'}
            homekit = true;
            yandex = true;
            sber = true;
            break;
          // Tilt of this cover
          case 'cover_tilt':
            break;
          // Triggered action (e.g. a button click)
          case 'enum_action':
            setIdent('mode');
            break;
          case 'enum_backlight_mode':
            // capability.values = feature.values;
            break;
          case 'enum_battery_state':
            // capability.values = feature.values;
            break;
          case 'enum_beep':
            // capability.values = feature.values;
            break;
          // switch: allow on/off, auto will use wired action via C1/C2 on contactor for example with HC/HP
          case 'enum_device_mode':
            // capability.values = feature.values;
            break;
          // Triggers an effect on the light (e.g. make light blink for a few seconds)
          case 'enum_effect':
            setIdent('mode');
            // capability.values = feature.values;
            break;
          // Force the valve position
          case 'enum_force':
            setIdent('mode');
            break;
          // PIR keep time in seconds
          case 'enum_keep_time':
            // capability.values = feature.values;
            break;
          case 'enum_key_state':
            // capability.values = feature.values;
            break;
          case 'enum_melody':
            // capability.values = feature.values;
            break;
          // Configures the dimming technique.
          case 'enum_mode_phase_control':
            // capability.values = feature.values;
            break;
          case 'enum_motion_sensitivity':
            // capability.values = feature.values;
            break;
          case 'enum_moving':
            // capability.values = feature.values;
            break;
          // Operation mode, select "command" to enable bindings (wake up the device before changing modes!)
          case 'enum_operation_mode':
            // capability.values = feature.values;
            break;
          // Controls the behaviour when the device is powered on
          case 'enum_power_on_behavior':
            // capability.values = feature.values;
            break;
          // Recover state after power outage
          case 'enum_power_outage_memory':
            // capability.values = feature.values;
            break;
          case 'enum_selftest':
            // capability.values = feature.values;
            break;
          case 'enum_sensitivity':
            // capability.values = feature.values;
            break;
          // Type of installed tubes
          case 'enum_sensors_type':
            // capability.values = feature.values;
            break;
          case 'enum_switch_actions':
            // capability.values = feature.values;
            break;
          case 'enum_switch_type':
            setIdent('mode');
            break;
          case 'enum_volume':
            // capability.values = feature.values;
            break;
          // Week format user for schedule
          case 'enum_week':
            setIdent('mode');
            break;
          case 'fan_undefined':
            break;
          // Brightness of this light
          case 'light_brightness':
          case 'light_min_brightness':
          case 'light_max_brightness':
            setIdent('range', 'light');
            break;
          // Color of this light expressed as hue/saturation
          case 'light_color_hs':
            break;
          // Color temperature of this light
          // Unit: mired
          case 'light_color_temp':
            setIdent('range', 'light');
            break;
          // Color temperature after cold power on of this light
          // Unit: mired
          case 'light_color_temp_startup':
            setIdent('range', 'light');
            break;
          // Color of this light in the CIE 1931 color space (x/y)
          case 'light_color_xy':
            setIdent('rgb', 'light');
            break;
          // Configure genLevelCtrl
          case 'light_level_config':
            break;
          // On/off state of this light
          case 'light_state':
            setIdent('power');
            // capability.value_on = feature.value_on;
            // capability.value_off = feature.value_off;
            break;
          case 'lock_state':
            setIdent('power');
            break;
          case 'numeric_action_code':
            break;
          // Critical radiation level
          // Unit: μR/h
          case 'numeric_alert_threshold':
            break;
          // Air quality index
          case 'numeric_aqi':
            break;
          // Away preset days
          case 'numeric_away_preset_days':
            setIdent('text');
            break;
          // Away preset temperature
          // Unit: °C
          case 'numeric_away_preset_temperature':
            setIdent('text');
            break;
          // Specifies the maximum light output of the ballast
          case 'numeric_ballast_maximum_level':
            break;
          // Specifies the minimum light output of the ballast
          case 'numeric_ballast_minimum_level':
            break;
          // Specifies the maximum light output the ballast can achieve.
          case 'numeric_ballast_physical_maximum_level':
            break;
          // Specifies the minimum light output the ballast can achieve.
          case 'numeric_ballast_physical_minimum_level':
            break;
          // Remaining battery in %
          // Unit: %
          case 'numeric_battery':
            setIdent('battery_level');
            break;
          // Boost time
          // Unit: s
          case 'numeric_boost_time':
            setIdent('text');
            break;
          case 'numeric_brightness':
            break;
          // The measured CO2 (carbon monoxide) value
          // Unit: ppm
          case 'numeric_co2':
            setIdent('co2');
            break;
          // Comfort temperature
          // Unit: °C
          case 'numeric_comfort_temperature':
            setIdent('target_temperature');
            break;
          // Indicates with how many Watts the maximum possible power consumption is exceeded
          // Unit: W
          case 'numeric_consumer_overload':
            break;
          // Temperature of the CPU
          // Unit: °C
          case 'numeric_cpu_temperature':
            break;
          // Instantaneous measured electrical current
          // Unit: A
          case 'numeric_current':
            break;
          // Instantaneous measured electrical current on phase B
          // Unit: A
          case 'numeric_current_phase_b':
            break;
          // Instantaneous measured electrical current on phase C
          // Unit: A
          case 'numeric_current_phase_c':
            break;
          // Temperature of the device
          // Unit: °C
          case 'numeric_device_temperature':
            break;
          // Unit: second
          case 'numeric_duration':
            break;
          // Eco temperature
          // Unit: °C
          case 'numeric_eco_temperature':
            setIdent('target_temperature');
            break;
          // Measured eCO2 value
          // Unit: ppm
          case 'numeric_eco2':
            break;
          // Sum of consumed energy
          // Unit: kWh
          case 'numeric_energy':
            setIdent('power_usage');
            break;
          case 'numeric_formaldehyd':
            setIdent('text');
            break;
          case 'numeric_gas_density':
            break;
          // Measured Hcho value
          // Unit: µg/m³
          case 'numeric_hcho':
            break;
          // Measured relative humidity
          // Unit: %
          case 'numeric_humidity':
            setIdent('humidity', 'humidity_sensor');
            break;
          // Humidity calibration
          case 'numeric_humidity_calibration':
            break;
          // Unit: %
          case 'numeric_humidity_max':
            break;
          // Unit: %
          case 'numeric_humidity_min':
            break;
          // Adjust humidity
          // Unit: %
          case 'numeric_humidity_offset':
            break;
          // Measured illuminance in lux
          // Unit: lx
          case 'numeric_illuminance':
            setIdent('illuminance');
            break;
          // Illuminance calibration
          case 'numeric_illuminance_calibration':
            break;
          // Measured illuminance in lux
          // Unit: lx
          case 'numeric_illuminance_lux':
            setIdent('illuminance');
            break;
          // Link quality (signal strength)
          // Unit: lqi
          case 'numeric_linkquality':
            setIdent('text');
            break;
          // Current temperature measured on the device
          // Unit: °C
          case 'numeric_local_temperature':
            break;
          // Maximum temperature
          // Unit: °C
          case 'numeric_max_temperature':
            setIdent('target_temperature');
            break;
          // Minimum temperature
          // Unit: °C
          case 'numeric_min_temperature':
            setIdent('target_temperature');
            break;
          // Time in seconds till occupancy goes to false
          // Unit: s
          case 'numeric_occupancy_timeout':
            break;
          // Measured PM10 (particulate matter) concentration
          // Unit: µg/m³
          case 'numeric_pm10':
            break;
          // Measured PM2.5 (particulate matter) concentration
          // Unit: µg/m³
          case 'numeric_pm25':
            break;
          // Position
          // Unit: %
          case 'numeric_position':
            setIdent('range');
            break;
          // Instantaneous measured power
          // Unit: W
          case 'numeric_power':
            setIdent('power_load');
            break;
          // The measured atmospheric pressure
          // Unit: hPa
          case 'numeric_pressure':
            setIdent('atmospheric_pressure');
            break;
          // Adjust pressure
          // Unit: hPa
          case 'numeric_pressure_offset':
            break;
          // Current radiation level
          // Unit: μR/h
          case 'numeric_radiation_dose_per_hour':
            break;
          // Current count radioactive pulses per minute
          // Unit: rpm
          case 'numeric_radioactive_events_per_minute':
            break;
          // Reporting interval in minutes
          case 'numeric_reporting_time':
            break;
          case 'numeric_requested_brightness_level':
            break;
          case 'numeric_requested_brightness_percent':
            break;
          // This is applicable if tubes type is set to other
          case 'numeric_sensitivity':
            break;
          // Count of installed tubes
          case 'numeric_sensors_count':
            break;
          case 'numeric_smoke_density':
            break;
          // Measured soil moisture value
          // Unit: %
          case 'numeric_soil_moisture':
            break;
          case 'numeric_strength':
            break;
          // Measured temperature value
          // Unit: °C
          case 'numeric_temperature':
            setIdent('temperature');
            homekit = true;
            yandex = true;
            sber = true;
            break;
          // Measured temperature value
          // Unit: °C
          case 'numeric_temperature_bme':
            break;
          // Temperature calibration
          case 'numeric_temperature_calibration':
            break;
          // Measured temperature value
          // Unit: °C
          case 'numeric_temperature_ds':
            break;
          // Unit: °C
          case 'numeric_temperature_max':
            break;
          // Unit: °C
          case 'numeric_temperature_min':
            break;
          // Adjust temperature
          // Unit: °C
          case 'numeric_temperature_offset':
            break;
          // Warning (LED2) CO2 level
          // Unit: ppm
          case 'numeric_threshold1':
            break;
          // Critical (LED3) CO2 level
          // Unit: ppm
          case 'numeric_threshold2':
            break;
          // Measured VOC value
          // Unit: ppb
          case 'numeric_voc':
            setIdent('voc');
            break;
          // Measured electrical potential value
          // Unit: V
          case 'numeric_voltage':
            setIdent('voltage');
            break;
          // Measured electrical potential value on phase B
          // Unit: V
          case 'numeric_voltage_phase_b':
            break;
          // Measured electrical potential value on phase C
          // Unit: V
          case 'numeric_voltage_phase_c':
            break;
          // On/off state of the switch
          case 'switch_state':
            setIdent('power');
            homekit = true;
            yandex = true;
            sber = true;
            break;
          case 'text_':
            break;
          case 'text_action_zone':
            break;
          case 'text_direction':
            break;
          case 'text_inserted':
            break;
          case 'numeric_target_distance':
            setIdent('text');
            break;
          case 'numeric_radar_sensitivity':
            setIdent('range');
            break;
          case 'numeric_minimum_range':
            setIdent('range');
            break;
          case 'numeric_maximum_range':
            setIdent('range');
            break;
          case 'numeric_detection_delay':
            setIdent('range');
            break;
          case 'text_learned_ir_code':
            setIdent('text');
            break;
          default:
            log(expose.type, feature, deviceTemplate);
          // ident = 'text';
        }
        this.app.log(`Check DONE: ${ident}`);
        if (feature.unit) {
          if (this.pluginTemplate && this.pluginTemplate.units && this.pluginTemplate.units[feature.unit]) {
            capability.scale = this.pluginTemplate.units[feature.unit];
          } else {
          }
        }
        if (ident) {
          if (!capabilities.find((item) => item.property === capability.property)) {
            capability.ident = ident;
            capability.display_name = display_name;
            if (homekit) {
              capability.homekit = homekit;
            }
            if (yandex) {
              capability.yandex = yandex;
            }
            if (sber) {
              capability.sber = sber;
            }
            capabilities.push(capability);
          }
        } else {
          log(expose.type, feature, deviceTemplate);
        }
      };
      let exposes;
      if (deviceTemplate.exposes && Array.isArray(deviceTemplate.exposes)) {
        exposes = deviceTemplate.exposes
      } else {
        exposes = deviceTemplate.exposes();
      }
      if (exposes) {
        exposes.forEach((expose: any, index: any) => {
          switch (expose.type) {
            case 'climate':
            case 'composite':
            case 'cover':
            case 'fan':
            case 'light':
            case 'lock':
            case 'switch':
              if (expose.features) {
                expose.features.forEach((feature: any, index2: any) => {
                  addFeature(expose, feature, `${index}${index2}`);
                });
              }
              break;
            case 'binary':
            case 'enum':
            case 'numeric':
            case 'text':
              addFeature(expose, expose, `${index}0`);
              break;
            default:
              log(expose.type, expose, deviceTemplate);
          }
        });
      }
      if (capabilities.length && identifier) {
        const add = (identifier: string, capabilities: any, parent_identifier: string | null = null, child_name: string | null = null) => {
          const params: any = {
            icon,
            identifier,
            capabilities,
            manufacturer: deviceTemplate.vendor
          };
          if (parent_identifier) {
            params['parent_identifier'] = parent_identifier;
          }
          let name = device.friendly_name;
          if (device.definition && device.definition.description) {
            name = `${device.definition.description} (${name})`;
          } else {
            if (device.description) {
              name = `${device.description} (${name})`;
            }
            if (device.manufacturerName) {
              name = `${device.manufacturerName} ${name}`;
            }
          }
          if (child_name) {
            name += child_name;
          }
          params['name'] = name;
          if (!this.devices.find((item) => item.identifier === identifier)) {
            this.checkSubDevice('zigbee2mqtt.subdevice', identifier, name, params, null, this).then(() => {
              this.devices.push(params);
              if (!parent_identifier) {
                capabilities.forEach((capability: any) => {
                  if (capability.access.toString(2).padStart(3).charAt(0) === '1') {
                    const options: any = {};
                    options[capability.property] = '';
                    this.mqttPublish(`zigbee2mqtt/${identifier}/get`, options);
                  } else {
                  }
                });
              }
            }).catch((error: any) => {
              this.app.errorEx(error);
            });
          }
        }
        const len = capabilities.filter(item => item.ident === 'power').length;
        if (len > 1) {
          const add1 = (caps: string[], ident: string, name: string) => {
            const cap = capabilities.find(item => caps.indexOf(item.property) !== -1);
            if (cap) {
              add(`${identifier}_${ident}`, [cap], identifier, name);
            }
          }
          add1(['state_l1', 'state_left'], '1', ` (Channel 1)`);
          add1(['state_l2', 'state_right'], '2', ` (Channel 2)`);
          if (len > 2) {
            add1(['state_l3'], '3', ` (Channel 3)`);
          }
          if (len > 3) {
            add1(['state_l4'], '4', ` (Channel 4)`);
          }
        }
        add(identifier, capabilities);
      }
    } else {
      this.app.log(`Device template not found ${identifier}`);
    }
  }

  deleteDevice(params: any) {
    this.mqttPublish('zigbee2mqtt/bridge/request/device/remove', {id: params.identifier, force: true});
  }

  async searchSerialDevices() {
    const devices: any = [];

    const manufacturers = [
      "texas instruments",
      "ti",
      "silicon labs",
      "silicon labs cp210x",
      "cp210x",
      "cp2102",
      "cp2104",
      "dresden elektronik ingenieurtechnik gmbh",
      "dresden elektronik",
      "tube's zb coordinator",
      "tube's zigbee",
      "nortek",
      "gocontrol",
      "nortek security & control",
      "itead",
      "sonoff",
      "electrolama",
      "zzh",
      "ikea",
      "ikea of sweden",
      "aeotec",
      "aeon labs",
      "phoscon"
    ];

    const vendors = [
      "0451", // Texas Instruments (TI)
      "10c4", // Silicon Labs
      "1cf1", // Dresden Elektronik (ConBee)
      "1a86", // Electrolama (zzh) and other devices based on CH340
      "0403", // FTDI (used in some Zigbee devices)
      "0681", // Tube's Zigbee Gateways
      "0658", // Nortek (Zigbee + Z-Wave USB sticks)
      "0457", // ITEAD (Sonoff Zigbee USB Dongle)
      "04d8", // IKEA TRÅDFRI USB Gateway
      "037a", // Aeotec
      "16c0"  // Some custom Zigbee devices
    ]

    const {SerialPort} = require('serialport');
    const ports = await SerialPort.list();

    console.log('Serial devices:');

    ports.forEach((port: any) => {
      console.log(`- port: ${port.path}, manufacturer: ${port.manufacturer}, vendorId: ${port.vendorId}`);

      const manufacturer = port.manufacturer ? port.manufacturer.toLowerCase() : '';
      const vendorId = port.vendorId ? port.vendorId.toLowerCase() : '';

      if (manufacturers.includes(manufacturer) || vendors.includes(vendorId)) {
        devices.push({
          id: port.path,
          title: `${port.path}, ${port.manufacturer}, ${port.vendorId}`,
        });
      }
    });

    console.log('Filtered devices:', devices);
    return devices;
  }

  getAdapterByPort(port: string) {
    const devices: any = this.searchSerialDevices();
    const device = devices.find((item: any) => item.id === port);
    if (device) {
      this.log('getAdapterByPort', 'device', port, device);

      const ember_substrings = ["10c4", "0457"];
      const check_ember = ember_substrings.every(substring => device.title.includes(substring));

      if (this.logging) {
        this.log('getAdapterByPort', 'check_ember', check_ember);
      }

      if (check_ember) {
        return 'ember';
      }
    }

    return null;
  }
}

process.on('uncaughtException', (err) => {
  console.error(`${err ? err.message : inspect(err)}`, err.stack);
});

const app = new Zigbee2mqtt();
app.logging = true;
// app.initDevice({params: {mqtt_address: '192.168.1.152', port: ''}}).then(() => {
//   app.connect({}).then(() => {
//   });
// });
