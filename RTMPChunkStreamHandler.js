const EventEmitter = require('events');

//Collects chunks from each stream and emits a message to the event handler

class RTMPChunkStreamHandler extends EventEmitter {
    
    constructor() {
        super();
        
        this.prev_timestamp;
        this.prev_timestamp_delta;
        this.prev_length;
        this.prev_type_id;
        this.prev_stream_id;
        this.prev_have_extended = false;
        
        this.parseMessageHeader = this.parseMessageHeader.bind(this);
        this.parseChunk = this.parseChunk.bind(this);
        this.parseProtocolControlMessage = this.parseProtocolControlMessage.bind(this);
        
        this.max_chunk_size = 128;
        this.partial_message = null;
        this.partial_message_length = 0;
    }
    

    static parseBasicHeader(chunk) {
        let basic_header = chunk.read(1).readUIntBE(0, 1);
        let basic_header_size = 1;
        //First two bits
        let fmt = basic_header >> 6;
        //Last 6 bits
        let cs_id = basic_header & 0x3F;
        let headerLength = 1;
        if(cs_id === 0) {
           headerLength = 2;
           //second byte + 64
           cs_id = chunk.readUIntBE(1, 1) + 64;
           basic_header_size = 2;
        }
        if(cs_id === 1) {
           headerLength = 3;
           //(third byte * 256) + (second byte + 64)
           cs_id = chunk.readUIntBE(1, 2);
           basic_header_size = 3;
        }
        
        return {
            headerLength: headerLength,
            fmt: fmt,
            chunkStreamId: cs_id
        };
    }
    
    parseMessageHeader(fmt, chunk) {
        let chunk_data_start = 0;
        switch(fmt) {
            case 0:
                chunk_data_start = 11;
                let timestamp = chunk.readUIntBE(0, 3);
                //if equals to 0xFFFFFF
                if(timestamp >= 16777215) {
                    chunk_data_start = 15;
                    //get extended
                    timestamp = chunk.readUIntBE(11, 4);
                    this.prev_have_extended = true;
                } else {
                    this.prev_have_extended = false;                    
                }
                
                let length = chunk.readUIntBE(3, 3);
                let type_id = chunk.readUIntBE(6, 1);
                let stream_id = chunk.readUIntLE(7, 4);
                
                this.prev_timestamp = timestamp;
                this.prev_timestamp_delta = 0;
                this.prev_length = length;
                this.prev_type_id = type_id;
                this.prev_stream_id = stream_id;
                break;
            case 1:
                chunk_data_start = 7;
                let timestamp_delta = chunk.readUIntBE(0, 3);
                
                if(timestamp_delta >= 16777215) {
                    chunk_data_start = 11;
                    timestamp_delta = chunk.readUIntBE(7, 4);
                    this.prev_have_extended = true;
                } else {
                    this.prev_have_extended = false;                    
                }
                
                let length = chunk.readUIntBE(3, 3);
                let type_id = chunk.readUIntBE(6, 1);
                
                this.prev_timestamp_delta = timestamp_delta;
                this.prev_length = length;
                this.prev_type_id = type_id;
                break;
            case 2:
                chunk_data_start = 3;
                let timestamp_delta = chunk.readUIntBE(0, 3);
                
                if(timestamp_delta >= 16777215) {
                    chunk_data_start = 7;
                    timestamp_delta = chunk.readUIntBE(3, 4);
                    this.prev_have_extended = true;
                } else {
                    this.prev_have_extended = false;                    
                }
                
                this.prev_timestamp_delta = timestamp_delta;
                break;
            case 3:
                chunk_data_start = 0;
                if(this.prev_have_extended) {
                    chunk_data_start = 4;
                    let timestamp_delta = chunk.readUIntBE(0, 4);
                    this.prev_timestamp_delta = timestamp_delta;
                } 
                break;
        }
        
        chunk_data = chunk.slice(chunk_data_start);
        
        return { 
            timestamp: this.prev_timestamp,
            timestamp_delta: this.prev_timestamp_delta,
            length: this.prev_length,
            type_id: this.prev_type_id,
            stream_id: this.prev_stream_id
            chunk_data: chunk_data
        };  
    }

    parseChunk(basicHeader, chunk) {
        
        let message = this.parseMessageHeader(basicHeader['fmt'], chunk.slice(basicHeader['headerLength']));
        
        //Assume typeid 3 if there is a partial message
        if(partialMessage) {
            this.partialMessage = Buffer.concat([this.partialMessage, message['chunk_data']);
            this.partial_message_length += message['chunk_data'].length;
            if(this.partial_message_length >= message['length']) {
                //emit message
                message['chunk_data'] = this.partialMessage;
                this.emit(message);
                this.partialMessage = null;
                this.partial_message_length = 0;
            }
        } else {
            //if message not received in full
            if(message['length'] <= message['chunk_data'].length) {
                this.partialMessage = message['chunk_data'];
                this.partial_message_length += message['chunk_data'].length;
            } else {
                //emit full message
                this.emit(message);
            }
        }
        if(basic_header['cs_id'] == 2 && message['stream_id'] == 0) {
            
        }
    }
    
    parseProtocolControlMessage(message) {
        
        //protocol control message
        /*
        1. Set Chunk Size
        2. Discard chunk stream ids  (4 bits)
        3. Acknowledgement 
        5. Window Acknowledgement Size
        6. Set Peer Bandwidth            
        */
        
    }
  
}

module.exports = {RTMPChunkStreamHandler};