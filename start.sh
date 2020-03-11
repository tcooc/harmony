#!/bin/bash

forever stop bot.js
forever start --uid=harmony --append --minUptime=10000 --spinSleepTime=5000 --killSignal=SIGTERM bot.js
