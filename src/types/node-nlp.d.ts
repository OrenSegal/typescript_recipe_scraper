declare module 'node-nlp' {
  export class NlpManager {
    constructor(options?: { languages?: string[]; forceNER?: boolean });
    addDocument(language: string, utterance: string, intent: string): void;
    addAnswer(language: string, intent: string, answer: string): void;
    addNamedEntityText(entityName: string, optionName: string, languages: string[], texts: string[]): void;
    train(): Promise<void>;
    save(): void;
    process(language: string, utterance: string): Promise<any>;
  }
}
