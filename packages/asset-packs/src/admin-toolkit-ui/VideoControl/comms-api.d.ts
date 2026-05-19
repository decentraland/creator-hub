declare module '~system/CommsApi' {
  export interface SubscribeToTopicRequest {
    topic: string;
  }

  export interface PublishDataRequest {
    topic: string;
    data: string;
  }

  export interface ConsumeMessagesRequest {
    topic: string;
  }

  // [
  //   {"sender":"presentation-bot:LocalPreview:b64-L1VzZXJzL2dhYnJpZWwuZGlhemRlY2VudHJhbGFuZC5vcmcvTGlicmFyeS9BcHBsaWNhdGlvbiBTdXBwb3J0L2NyZWF0b3ItaHViL1NjZW5lcy9DYXN0IERlbW8tTGFwdGl0by5sb2NhbA==:1774633657888",
  //     "data":"{
  //     \"type\":\"presentation:state\",
  //     \"id\":\"1225f864-cbc4-4458-8dbe-67d0ecde1100\",
  //     \"fileName\":\"Shape_Up_Demos_-_Cycle_16__6-weeks_\",
  //     \"slideCount\":149,\"currentSlide\":17,\"fileType\":\"pdf\",\"slideVideos\":[],\"videoState\":\"idle\"}"
  //   }]

  export interface ConsumeMessages {
    sender: string;
    data: string; // string -> PresentationState
  }

  export type ConsumeMessagesResponse = Array<ConsumeMessages>;

  export function subscribeToTopic(body: SubscribeToTopicRequest): Promise<void>;
  export function publishData(body: PublishDataRequest): Promise<void>;
  export function consumeMessages(body: ConsumeMessagesRequest): Promise<ConsumeMessagesResponse>;
}
