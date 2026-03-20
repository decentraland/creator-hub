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

  export interface ConsumeMessagesResponse {
    messages: string;
  }

  export function SubscribeToTopic(body: SubscribeToTopicRequest): Promise<void>;
  export function PublishData(body: PublishDataRequest): Promise<void>;
  export function ConsumeMessages(body: ConsumeMessagesRequest): Promise<ConsumeMessagesResponse>;
}
