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

  export interface UpdateMetadataRequest {
    metadata: string;
  }

  export function subscribeToTopic(body: SubscribeToTopicRequest): Promise<void>;
  export function publishData(body: PublishDataRequest): Promise<void>;
  export function consumeMessages(body: ConsumeMessagesRequest): Promise<ConsumeMessagesResponse>;
  export function updateMetadata(body: UpdateMetadataRequest): Promise<void>;
}
