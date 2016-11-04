#!/bin/bash

forever start -c nodejs --uid=harmony --append --minUptime=10000 --spinSleepTime=5000 --killSignal=SIGTERM main.js
