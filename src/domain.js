import {defineDomain} from '@deepseek-ai/dsh-storage-domain';
import {z} from 'zod';

const recommendation=z.object({primary:z.any().nullable(),alternatives:z.array(z.any()),noMatch:z.boolean(),confidence:z.number()}).strict();
const record=z.object({requestId:z.string(),at:z.string(),constraints:z.record(z.string(),z.boolean()),recommendation}).strict();
export const historyDomainSpec=defineDomain({name:'hanamesh_recommender',version:1,layout:'single',tables:{},global:{
  schema:z.object({schema:z.literal(1),revision:z.number().int().nonnegative(),records:z.array(record).max(20)}).strict(),
  initial:{schema:1,revision:0,records:[]},
}});
