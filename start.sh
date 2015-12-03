#!/bin/bash

forever start --minUptime=10000 --spinSleepTime=5000 --killSignal=SIGTERM main.js
