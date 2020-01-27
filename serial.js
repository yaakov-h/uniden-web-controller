// For details of Uniden's serial protocol, see:
//
// - http://sc230-oss.sourceforge.net/important/SC230_Protocol.pdf
// - http://info.uniden.com/twiki/pub/UnidenMan4/BCD536HPFirmwareUpdate/BCDx36HP_RemoteCommand_Specification_V1_05.pdf
// - http://info.uniden.com/twiki/pub/UnidenMan4/BCD536HPFirmwareUpdate/Remote_Command_Plan_v0.17.pdf
// - http://www.dslreports.com/r0/download/2169531~ba6babb3230f5fc5d656257aaed43916/UnidenProtocol.pdf

async function serial_writeCommand(writer, text) {
    await writer.write(text)
    await writer.write('\r')
}

async function serial_readResponse(reader) {
    let response = '';

    while (!response.endsWith('\r')) {
        let data = await reader.read();
        
        if (data.value !== undefined) {
            response += data.value;
        }

        if (data.done === true) {
            break;
        }
    }
    
    // Trim the trailing newline
    response = response.slice(0, response.length - 1);

    return response.split(',');
}

async function serial_readWrite(reader, writer, command) {
    await serial_writeCommand(writer, command);
    let response = await serial_readResponse(reader);

    var baseCommand = command.split(',')[0];
    if (response[0] != baseCommand) {
        throw new Error(`Command response mismatch: Expected ${baseCommand} but was ${response[0]}.`);
    }

    return response.slice(1);
}

async function serial_close() {
    await this.reader.cancel();
    await this.inputDone.catch(() => {});

    await this.writer.close();
    await this.outputDone;

    await this.port.close();
}

async function serial_connectPort(port, baudRate) {
    await port.open({ baudrate: baudRate });

    const decoder = new TextDecoderStream();
    const inputDone = port.readable.pipeTo(decoder.writable);
    const inputStream = decoder.readable;

    const reader = inputStream.getReader();

    const encoder = new TextEncoderStream();
    const outputDone = encoder.readable.pipeTo(port.writable);
    const outputStream = encoder.writable;

    const writer = outputStream.getWriter();

    return {
        port: port,
        reader: reader,
        writer: writer,

        write: serial_writeCommand.bind(undefined, writer),
        read: serial_readResponse.bind(undefined, reader),
        send: serial_readWrite.bind(undefined, reader, writer),
        close: serial_close,

        inputDone: inputDone,
        outputDone: outputDone,
        outputStream: outputStream,
    }
}
