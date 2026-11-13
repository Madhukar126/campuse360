import {proxyToCampusAi,validateSameOrigin} from '../../../../lib/ai-proxy';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const originError=validateSameOrigin(request);if(originError)return originError;
 const type=request.headers.get('content-type')||'';
 if(!type.toLowerCase().startsWith('multipart/form-data;'))return Response.json({error:'Upload a multipart form with a document.'},{status:415});
 const body=await request.arrayBuffer();if(body.byteLength>15*1024*1024+64000)return Response.json({error:'Upload exceeds the 15 MB limit.'},{status:413});
 return proxyToCampusAi(request,'/v1/documents',body,type);
}