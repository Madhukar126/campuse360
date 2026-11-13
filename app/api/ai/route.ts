import {proxyToCampusAi,validateSameOrigin} from '../../../lib/ai-proxy';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const originError=validateSameOrigin(request);if(originError)return originError;
 const type=request.headers.get('content-type')||'';
 if(!type.toLowerCase().includes('application/json'))return Response.json({error:'Send a JSON chat request.'},{status:415});
 const body=await request.arrayBuffer();if(body.byteLength>16384)return Response.json({error:'Request is too large.'},{status:413});
 return proxyToCampusAi(request,'/v1/chat',body,'application/json');
}