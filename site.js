function init() {
    if (!('serial' in navigator)) {
        const notSupported = document.querySelectorAll('.noserial');
        for (const element of notSupported) {
            element.classList.remove('hidden');
        }
        return;
    }
}

async function getSystemDetails(port, index) {
    let details = await port.send(`SIN,${index}`);
    return {
        type: details[0],
        name: details[1],
        quickKey: details[2],
        holdTime: details[3],
        lockout: details[4],
        reserved: details[5],
        delay: details[6],
        skip: details[7],
        emergencyAlert: details[8],
        revIndex: details[9],
        fwdIndex: details[10],
        channelGroupHead: details[11],
        channelGroupTail: details[12],
        sequence: details[13],
    }
}

function timeout(ms) {
    return new Promise((resolve, reject) => {
        let id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(`Timed out in ${ms}ms.`));
    }, ms)
  });
}

async function autoDetectBaudRate()
{
    const logArea = document.querySelector('div.log textarea');
    const log = (text) => logArea.value += text + '\r\n';
    logArea.value = 'Automatically detecting baud rate...\r\n';

    const bauds = Array.from(document.querySelectorAll('form select[name=baud] option')).reverse().map(e => parseInt(e.value, 10));

    let serialPort;
    try {
        serialPort = await navigator.serial.requestPort();
    }
    catch (e) {
        log(`Failed: ${e.message}`);
        return;
    }

    for (const baud of bauds) {
        log(`Trying baud rate ${baud}...`);

        let port = await serial_connectPort(serialPort, baud);
        try {
            await port.write('MDL');
            let response = await Promise.race([ port.read(), timeout(500) ]);
            while (response[0] === 'ERR') {
                // We can get error responses due to previous commands we sent at the wrong baud rate.
                // If we can identify this, just try again.

                await port.write('MDL');
                response = await Promise.race([ port.read(), timeout(500) ]);
            }

            if (response[0] !== 'MDL') {
                log('Got garbage response. Ignoring...');
            }
            
            log(`Auto-detected baud rate: ${baud}.`);
            log(`Found device: ${response[1]}`);
            document.querySelector('select[name=baud]').value = baud;
            return;
        }
        catch {
        }
        finally  {
            await port.close();
        }
    }

    log('Could not find any suitable baud rate.');
}

async function connect() {
    const logArea = document.querySelector('div.log textarea');
    const log = (text) => logArea.value += text + '\r\n';
    logArea.value = 'Connecting...\r\n';

    let serialPort;    
    try {
        serialPort = await navigator.serial.requestPort();
    }
    catch (e) {
        log(`Failed: ${e.message}`);
        return;
    }

    const baud = parseInt(document.querySelector('select[name=baud]').value, 10);
    const port = await serial_connectPort(serialPort, baud);

    try {
        let response = await Promise.race([ port.send('MDL'), timeout(5000) ]);
        
        log(`Model: ${response[0]}`);
        
        response = await port.send('PRG');
        if (response[0] != 'OK') {
            log(`Error: Failed to enter programming mode: ${response[0]}`);
            return;
        }

        log('Entered programming mode.')
        log('');

        response = await port.send('MEM');
        log(`Memory used: ${response[0]}%`);

        response = await port.send('SCT');
        const numSystems = parseInt(response[0], 10);
        log(`${numSystems} systems detected.`);

        if (numSystems > 0) {
            const head = await port.send('SIH');

            let currentSystemIndex = parseInt(head, 10);
            while (currentSystemIndex > 0) {
                let systemDetails = await getSystemDetails(port, currentSystemIndex);
                log(`Found system: ${systemDetails.name}`);

                let nextIndex = await port.send(`FWD,${currentSystemIndex}`);
                currentSystemIndex = parseInt(nextIndex[0], 10);
            }
        }

        response = await port.send('EPG');
        if (response[0] != 'OK') {
            log(`Error: Failed to exit programming mode: ${response[0]}`);
            return;
        }
        log('Exited programming mode.');

        await port.close();
        log('Disconnected.');
    }
    catch (error) {
        log(`Unhandled error: ${error.message}`);
        log('Disconnecting...');

        try {
            await port.close();
        }
        catch {
        }

        log('Disconnected.');
    }
}

document.addEventListener("DOMContentLoaded", function(event) {
    init();
});