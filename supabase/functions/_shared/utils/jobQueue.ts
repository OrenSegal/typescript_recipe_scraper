import { FetchProcessOptions } from '../types';

interface Job {
  url: string;
  options: FetchProcessOptions;
}

export class JobQueue {
  private jobs: Job[] = [];

  add(job: Job): void {
    this.jobs.push(job);
  }

  getNext(): Job | undefined {
    return this.jobs.shift();
  }

  get length(): number {
    return this.jobs.length;
  }
}

export const jobQueue = new JobQueue();
