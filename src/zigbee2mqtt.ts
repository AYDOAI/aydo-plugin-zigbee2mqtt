import {inspect} from 'util';
import {baseDriverModule} from '../core/base-driver-module';
import {ColorConverter} from '../lib/color-converter';

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
    if (this.device) {
      this.app.log('initDeviceEx already done');
      return resolve({});
    }
    super.initDeviceEx(() => {
      this.capabilities = [];
      this.capabilities.push({ident: 'power', display_name: 'Add Zigbee Device', options: {link_devices: true}});
      // this.capabilities.push({ident: 'push_button', index: '2', display_name: 'Refresh network map'});
      this.capabilities.push({ident: 'text', index: '1', display_name: 'Online devices'});
      this.capabilities.push({ident: 'text', index: '2', display_name: 'Offline devices'});
      // this.capabilities.push({ident: 'image', index: '1'});
      try {
        this.converters = require('zigbee-herdsman-converters');
      } catch (e) {
        this.app.errorEx(e);
      }
      this.device = {};
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
      return this.updateState(resolve, reject);
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
        return a.ident === 'power' ? -1 : 1;
      } else if (a.ident === 'image' || b.ident === 'image') {
        return a.ident === 'image' ? -1 : 1;
      } else if (a.ident === 'push_button' || b.ident === 'push_button') {
        return a.ident === 'push_button' ? -1 : 1;
      } else if (a.ident === 'power') {
        const titleA = `${a.zone_name} (${a.display_name})`;
        const titleB = `${b.zone_name} (${b.display_name})`;
        return titleA.localeCompare(titleB);
      }
    });
  }

  commandEx(command: any, value: any, params: any, options1: any, resolve: any, reject: any) {
    switch (command) {
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
              const enableTitle = 'Zigbee: The controller is in pairing mode. Use the instructions for the device you are adding.'
              const disableTitle = 'Zigbee: Controller pairing mode is disabled.'
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
    this.log('publish', topic, value);
    this.mqtt.publish(topic, typeof value === 'object' ? JSON.stringify(value) : value);
  }

  updateState(resolve: any, reject: any) {
    this.mqttPublish('zigbee2mqtt/bridge/config/devices/get', null);
    if (resolve) {
      resolve({});
    }
  }

  message(topic: any, message: any) {
    const params = topic.split('/');
    if (params && params.length > 1) {
      let ident: any;
      let body: any;
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
                  options: {read_only: true, power_on_button_title: 'online', power_off_button_title: 'offline'},
                  zone_name: dev ? dev.zone_name : '',
                  online: availability.online,
                  display_name: '',
                };
                if (dev) {
                  cap.display_name = `${dev.name}${dev.name && dev.name.indexOf(availability.ident) === -1 ? ` [${availability.ident}]` : ''}${dev.zone_name ? ` (${dev.zone_name})` : ''}`
                } else {
                  cap.display_name = availability.ident;
                }
                // this.capabilities.push(cap);
              }
              status[`power_${index + 1}`] = availability.online;
            });
            this.sort();
            this.publish(this.eventTypeStatus(this.pluginTemplate.class_name, this.id), status);
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
                    graph = graph.replace(`${capability.identifier}|${capability.identifier}`, `${capability.display_name}|${capability.identifier}`);
                  }
                });

                graphVizToImgBuffer(graph).then((buffer: string) => {
                  let b64 = Buffer.from(buffer).toString('base64');
                  this.statusEventName = this.eventTypeStatus(this.pluginTemplate.class_name, this.id);
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
              if (capability.value_on !== undefined) {
                status[`${capability.ident}_${capability.index}`] = body[capability.property] === capability.value_on;
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
    }
  }

  bridgeLog(payload: any) {
    this.app.log('bridgeLog', payload);
    let msg = '';
    switch (payload.type) {
      case 'device_announce':
      case 'device_announced':
        msg = `Device ${payload.message.friendly_name} announced`;
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
        break;
      default:
        this.app.log(payload);
    }
    if (msg) {
      this.sendNotify(msg);
    }
  }

  parseDevices(body: any) {
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
      body.forEach((device: any) => {
        const identifier = device.friendly_name ? device.friendly_name : device.ieeeAddr;
        let model = device.model ? device.model : (device.definition ? device.definition.model : null);
        if (identifier && model) {
          if (model === 'RR620ZB') {
            model = 'MG-ZG02W'
          }
          const deviceTemplate = this.converters.devices.find((item: any) => item.model === model ||
            (item.whiteLabel && item.whiteLabel.find((item1: any) => item1.model === model)));
          this.parseDevice(identifier, device, deviceTemplate);
        }
      });
    }
  }

  parseDevice(identifier: any, device: any, deviceTemplate: any) {
    if (deviceTemplate) {
      let icon: string;
      const capabilities: any[] = [];
      const log = (type: any, feature: any, template: any) => {
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
              break;
          }
        };

        this.app.log(`Check TRY: ${expose.type}_${feature.name}`);
        switch (`${expose.type}_${feature.name}`) {
          case 'binary_alarm':
            break;
          case 'binary_auto_off':
            break;
          case 'binary_battery_low':
            setIdent('text');
            break;
          case 'binary_buzzer_feedback':
            break;
          case 'binary_calibration':
            break;
          case 'binary_capabilities_configurable_curve':
            break;
          case 'binary_capabilities_forward_phase_control':
            break;
          case 'binary_capabilities_overload_detection':
            break;
          case 'binary_capabilities_reactance_discriminator':
            break;
          case 'binary_capabilities_reverse_phase_control':
            break;
          case 'binary_carbon_monoxide':
            break;
          case 'binary_consumer_connected':
            break;
          case 'binary_contact':
            setIdent('magnet');
            break;
          case 'binary_enable_abc':
            break;
          case 'binary_gas':
            break;
          case 'binary_humidity_alarm':
            break;
          case 'binary_interlock':
            setIdent('power');
            break;
          case 'binary_led':
            break;
          case 'binary_led_disabled_night':
            break;
          case 'binary_led_enable':
            break;
          case 'binary_led_feedback':
            break;
          case 'binary_led_state':
            break;
          case 'binary_motor_reversal':
            break;
          case 'binary_moving':
            break;
          case 'binary_occupancy':
            setIdent('motion');
            break;
          case 'binary_pir_enable':
            break;
          case 'binary_power_alarm':
            break;
          case 'binary_power_alarm_active':
            break;
          case 'binary_power_outage_memory':
            break;
          case 'binary_presence':
            setIdent('motion');
            break;
          case 'binary_reporting_enable':
            break;
          case 'binary_reverse':
            break;
          case 'binary_smoke':
            setIdent('smoke');
            break;
          case 'binary_sos':
            break;
          case 'binary_state':
            setIdent('power');
            break;
          case 'binary_status_capacitive_load':
            break;
          case 'binary_status_forward_phase_control':
            break;
          case 'binary_status_inductive_load':
            break;
          case 'binary_status_overload':
            break;
          case 'binary_status_reverse_phase_control':
            break;
          case 'binary_tamper':
            setIdent('tamper');
            break;
          case 'binary_temperature_alarm':
            break;
          case 'binary_vibration':
            break;
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
          case 'cover_position':
            setIdent('range', 'view_column');
            break;
          case 'cover_state':
            setIdent('power', 'view_column');
            homekit = true;
            yandex = true;
            sber = true;
            break;
          case 'cover_tilt':
            break;
          case 'enum_action':
            setIdent('mode');
            break;
          case 'enum_backlight_mode':
            break;
          case 'enum_battery_state':
            break;
          case 'enum_beep':
            break;
          case 'enum_device_mode':
            break;
          case 'enum_effect':
            setIdent('mode');
            break;
          case 'enum_force':
            setIdent('mode');
            break;
          case 'enum_keep_time':
            break;
          case 'enum_key_state':
            break;
          case 'enum_melody':
            break;
          case 'enum_mode_phase_control':
            break;
          case 'enum_motion_sensitivity':
            break;
          case 'enum_moving':
            break;
          case 'enum_operation_mode':
            break;
          case 'enum_power_on_behavior':
            break;
          case 'enum_power_outage_memory':
            break;
          case 'enum_selftest':
            break;
          case 'enum_sensitivity':
            break;
          case 'enum_sensors_type':
            break;
          case 'enum_switch_actions':
            break;
          case 'enum_switch_type':
            setIdent('mode');
            break;
          case 'enum_volume':
            break;
          case 'enum_week':
            setIdent('mode');
            break;
          case 'fan_undefined':
            break;
          case 'light_brightness':
          case 'light_min_brightness':
          case 'light_max_brightness':
            setIdent('range', 'light');
            break;
          case 'light_color_hs':
            break;
          case 'light_color_temp':
            setIdent('range', 'light');
            break;
          case 'light_color_temp_startup':
            setIdent('range', 'light');
            break;
          case 'light_color_xy':
            setIdent('rgb', 'light');
            break;
          case 'light_level_config':
            break;
          case 'light_state':
            setIdent('power');
            break;
          case 'lock_state':
            setIdent('power');
            break;
          case 'numeric_action_code':
            break;
          case 'numeric_alert_threshold':
            break;
          case 'numeric_aqi':
            break;
          case 'numeric_away_preset_days':
            setIdent('text');
            break;
          case 'numeric_away_preset_temperature':
            setIdent('text');
            break;
          case 'numeric_ballast_maximum_level':
            break;
          case 'numeric_ballast_minimum_level':
            break;
          case 'numeric_ballast_physical_maximum_level':
            break;
          case 'numeric_ballast_physical_minimum_level':
            break;
          case 'numeric_battery':
            setIdent('battery_level');
            break;
          case 'numeric_boost_time':
            setIdent('text');
            break;
          case 'numeric_brightness':
            break;
          case 'numeric_co2':
            setIdent('co2');
            break;
          case 'numeric_comfort_temperature':
            setIdent('target_temperature');
            break;
          case 'numeric_consumer_overload':
            break;
          case 'numeric_cpu_temperature':
            break;
          case 'numeric_current':
            break;
          case 'numeric_current_phase_b':
            break;
          case 'numeric_current_phase_c':
            break;
          case 'numeric_device_temperature':
            break;
          case 'numeric_duration':
            break;
          case 'numeric_eco_temperature':
            setIdent('target_temperature');
            break;
          case 'numeric_eco2':
            break;
          case 'numeric_energy':
            setIdent('power_usage');
            break;
          case 'numeric_formaldehyd':
            setIdent('text');
            break;
          case 'numeric_gas_density':
            break;
          case 'numeric_hcho':
            break;
          case 'numeric_humidity':
            setIdent('humidity', 'humidity_sensor');
            break;
          case 'numeric_humidity_calibration':
            break;
          case 'numeric_humidity_max':
            break;
          case 'numeric_humidity_min':
            break;
          case 'numeric_humidity_offset':
            break;
          case 'numeric_illuminance':
            setIdent('illuminance');
            break;
          case 'numeric_illuminance_calibration':
            break;
          case 'numeric_illuminance_lux':
            setIdent('illuminance');
            break;
          case 'numeric_linkquality':
            setIdent('text');
            break;
          case 'numeric_local_temperature':
            break;
          case 'numeric_max_temperature':
            setIdent('target_temperature');
            break;
          case 'numeric_min_temperature':
            setIdent('target_temperature');
            break;
          case 'numeric_occupancy_timeout':
            break;
          case 'numeric_pm10':
            break;
          case 'numeric_pm25':
            break;
          case 'numeric_position':
            setIdent('range');
            break;
          case 'numeric_power':
            setIdent('power_load');
            break;
          case 'numeric_pressure':
            setIdent('atmospheric_pressure');
            break;
          case 'numeric_pressure_offset':
            break;
          case 'numeric_radiation_dose_per_hour':
            break;
          case 'numeric_radioactive_events_per_minute':
            break;
          case 'numeric_reporting_time':
            break;
          case 'numeric_requested_brightness_level':
            break;
          case 'numeric_requested_brightness_percent':
            break;
          case 'numeric_sensitivity':
            break;
          case 'numeric_sensors_count':
            break;
          case 'numeric_smoke_density':
            break;
          case 'numeric_soil_moisture':
            break;
          case 'numeric_strength':
            break;
          case 'numeric_temperature':
            setIdent('temperature');
            homekit = true;
            yandex = true;
            sber = true;
            break;
          case 'numeric_temperature_bme':
            break;
          case 'numeric_temperature_calibration':
            break;
          case 'numeric_temperature_ds':
            break;
          case 'numeric_temperature_max':
            break;
          case 'numeric_temperature_min':
            break;
          case 'numeric_temperature_offset':
            break;
          case 'numeric_threshold1':
            break;
          case 'numeric_threshold2':
            break;
          case 'numeric_voc':
            setIdent('voc');
            break;
          case 'numeric_voltage':
            setIdent('voltage');
            break;
          case 'numeric_voltage_phase_b':
            break;
          case 'numeric_voltage_phase_c':
            break;
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
        }
        this.app.log(`Check DONE: ${ident}`);
        if (feature.unit) {
          if (this.pluginTemplate && this.pluginTemplate.units && this.pluginTemplate.units[feature.unit]) {
            capability.scale = this.pluginTemplate.units[feature.unit];
          } else {
            capability.unit = feature.unit;
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
      deviceTemplate.exposes.forEach((expose: any, index: any) => {
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
      if (capabilities.length && identifier) {
        const add = (identifier: string, capabilities: any, parent_identifier: string = null, child_name: string = null) => {
          const params: any = {
            icon,
            identifier,
            capabilities,
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
}

process.on('uncaughtException', (err) => {
  console.error(`${err ? err.message : inspect(err)}`, err.stack);
});

const app = new Zigbee2mqtt();
app.logging = true;
