// WebP container dimensions, without decoding or adding a native test dependency.
export function webpDimensions(bytes){
 if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw new Error('Expected a WebP image');
 for(let at=12;at+8<=bytes.length;){
  const type=bytes.toString('ascii',at,at+4),length=bytes.readUInt32LE(at+4),data=at+8;
  if(data+length>bytes.length)throw new Error('Truncated WebP chunk');
  if(type==='VP8X'&&length>=10)return {width:bytes.readUIntLE(data+4,3)+1,height:bytes.readUIntLE(data+7,3)+1};
  if(type==='VP8L'&&length>=5&&bytes[data]===0x2f){const bits=bytes.readUInt32LE(data+1);return {width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1};}
  if(type==='VP8 '&&length>=10&&bytes[data+3]===0x9d&&bytes[data+4]===1&&bytes[data+5]===0x2a)return {width:bytes.readUInt16LE(data+6)&0x3fff,height:bytes.readUInt16LE(data+8)&0x3fff};
  at=data+length+(length&1);
 }
 throw new Error('WebP has no supported image chunk');
}
