#!/bin/bash

forever start --uid=harmony --append --minUptime=10000 --spinSleepTime=5000 --killSignal=SIGTERM main.js
