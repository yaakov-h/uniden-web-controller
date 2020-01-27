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


async function connect() {
    const logArea = document.querySelector('div.log textarea');
    logArea.value = 'Connecting...\r\n';

    const log = (text) => logArea.value += text + '\r\n';

    const port = await serial_openPort();

    let response = await port.send('MDL');
    log(`Model: ${response[0]}`);
    
    response = await port.send('PRG');
    if (response[0] != 'OK')
    {
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

    if (numSystems > 0)
    {
        const head = await port.send('SIH');

        let currentSystemIndex = parseInt(head, 10);
        while (currentSystemIndex > 0)
        {
            let systemDetails = await getSystemDetails(port, currentSystemIndex);
            log(`Found system: ${systemDetails.name}`);

            let nextIndex = await port.send(`FWD,${currentSystemIndex}`);
            currentSystemIndex = parseInt(nextIndex[0], 10);
        }
    }

    response = await port.send('EPG');
    if (response[0] != 'OK')
    {
        log(`Error: Failed to exit programming mode: ${response[0]}`);
        return;
    }
    log('Exited programming mode.');
    await port.close();
    log('Disconnected.');
}

document.addEventListener("DOMContentLoaded", function(event) {
    init();
});