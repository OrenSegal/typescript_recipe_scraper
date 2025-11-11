import { FetchProcessOptions } from "../../../../functions/_shared/types";

interface Job {
  url: string;
  options: FetchProcessOptions;
}

class JobQueue {
  private jobs: Job[] = [];

  add(job: Job) {
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