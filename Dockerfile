# Base image
FROM node:18

RUN apt update
RUN apt install -y build-essential libavahi-compat-libdnssd-dev
RUN apt install -y make gcc python3 git zip iw libtool libudev-dev libnss-mdns dnsmasq hostapd autoconf automake g++ avahi-daemon avahi-discover mosquitto sqlite3 ntp
RUN npm install -g nodemon

# Create app directory
WORKDIR /usr/src/app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install app dependencies
RUN npm install
RUN npm install --only=dev
