import {EventEmitter} from 'events';

const {toExtendable} = require('../lib/foibles');

const config: any = {host: '', port: '', logging: ''};

export const baseModule = toExtendable(class baseModule extends EventEmitter {

  config: any;
  ipc: any;
  requestId = 0;
  events: any[] = [];

  constructor() {
    super();
    if (this.loadConfig) {
      this.config = eval(`require('${process.cwd()}/config/config')`);
    }
    this.ipc = require('node-ipc');

    this.ipc.config.id = this.id;
    this.ipc.config.retry = 1500;
    this.ipc.config.logger = () => {
      // console.log(p1, p2, p3)
    };

    const handle = () => {
      this.updateEvents();
      // console.log(this.id, 'connected', this.events.length);
      this.onAppConnected();

      this.ipc.of.app.on('connect', () => {
        // @ts-ignore
        if (this.app && this.app.log) {
          // @ts-ignore
          this.app.log(`connected`);
        } else {
          console.log('connected')
        }
        this.onConnect();
        this.ipc.of.app.emit('hello', {id: this.id});
      });

      this.events.forEach((event: any) => {
        // console.log('subscribe', event.name)
        this.ipc.of.app.on(event.name, (p1: any, p2: any, p3: any) => {
          // console.log('base-module', event.name)
          const result = event.method(p1, p2, p3);
          if (result && result.constructor && result.constructor.name === 'Promise') {
            result.then(() => {
            }).catch(() => {
            })
          }
        });
      });
    };

    if (config['logging']) {
      // @ts-ignore
      this.logging = true;
    }
    if (config['host'] && config['host']) {
      console.log(`Connecting to ${config['host']}:${config['port']}`);
      this.ipc.connectToNet('app', config['host'], parseInt(config['port']), handle.bind(this));
    } else {
      // @ts-ignore
      if (this.app && this.app.log) {
        // @ts-ignore
        this.app.log(`Connecting to localhost:8000`);
      } else {
        console.log(`Connecting to localhost:8000`);
      }
      this.ipc.connectToNet('app', handle.bind(this));
    }
  }

  get loadConfig() {
    return true;
  }

  get id() {
    return '';
  }

  updateEvents() {

  }

  onAppConnected() {

  }

  onConnect() {

  }

  request(eventName: any, params = {}) {
    return new Promise((resolve, reject) => {
      this.requestId++;
      const id = this.requestId;
      this.ipc.of.app.emit(eventName, Object.assign({id}, params));
      const event = (response: any) => {
        if (response && response.id === id) {
          if (response['error']) {
            reject(response['error']);
          } else {
            resolve(response['result']);
          }
          this.ipc.of.app.off(eventName, event);
        }
      };
      this.ipc.of.app.on(eventName, event);
    });
  }

  requestEx(eventName: any, params = {}) {
    this.requestId++;
    const id = this.requestId;
    this.ipc.of.app.emit(eventName, Object.assign({id}, params));
  }

  log(message: any) {
    console.log(message);
  }

  error(message: any) {
    console.error(message);
  }

  require(ident: any, require1 = false) {
    return new Promise((resolve) => {
      resolve(require(ident))
    });
  }

});

process.argv.forEach(arg => {
  Object.keys(config).forEach(key => {
    if (arg.indexOf(`${key}=`) !== -1) {
      config[key] = arg.split('=')[1];
      console.log(`Set param ${key}=${config[key]}`)
    }
  })
});
