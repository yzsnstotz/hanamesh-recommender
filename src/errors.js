export class RecommenderError extends Error{
  constructor(code,status=500,message=code,details={}){super(message);this.name='RecommenderError';this.code=code;this.status=status;this.details=details;}
}

export function safeError(error){
  return error instanceof RecommenderError?error:new RecommenderError('RECOMMENDER_INTERNAL_ERROR',500,'The request could not be completed.');
}
