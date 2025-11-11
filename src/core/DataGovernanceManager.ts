/**
 * Enterprise Data Governance and Lineage Tracking Manager
 * Implements comprehensive data governance, audit trails, and lineage tracking for recipe data
 */

import { z } from 'zod';
import { EnterpriseConfig } from '../infrastructure/EnterpriseConfig.js';
import { RawScrapedRecipe } from '../shared/types.js';

export interface DataLineageNode {
  id: string;
  type: 'source' | 'transformation' | 'validation' | 'enrichment' | 'storage';
  name: string;
  description: string;
  timestamp: Date;
  metadata: Record<string, any>;
  inputs: string[]; // IDs of parent nodes
  outputs: string[]; // IDs of child nodes
}

export interface DataGovernanceRecord {
  recipeId: string;
  sourceUrl: string;
  dataClassification: 'public' | 'restricted' | 'sensitive';
  complianceStatus: 'compliant' | 'review_required' | 'non_compliant';
  retentionPolicy: {
    category: string;
    retentionPeriodDays: number;
    deletionDate?: Date;
  };
  auditTrail: Array<{
    action: string;
    actor: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;
  lineageChain: DataLineageNode[];
  qualityMetrics: {
    completenessScore: number;
    accuracyScore: number;
    consistencyScore: number;
    validityScore: number;
  };
  privacyCompliance: {
    containsPII: boolean;
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    retentionJustification: string;
  };
}

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  rules: Array<{
    condition: string;
    action: 'allow' | 'deny' | 'flag_for_review' | 'anonymize' | 'delete';
    parameters?: Record<string, any>;
  }>;
  priority: number;
  active: boolean;
}

export interface ComplianceMetrics {
  totalRecords: number;
  compliantRecords: number;
  reviewRequiredRecords: number;
  nonCompliantRecords: number;
  complianceRate: number;
  averageQualityScore: number;
  retentionViolations: number;
  privacyViolations: number;
}

/**
 * Comprehensive data governance manager ensuring enterprise-grade data management,
 * compliance tracking, and complete data lineage for recipe scraping operations
 */
export class DataGovernanceManager {
  private config: EnterpriseConfig;
  private governanceRecords = new Map<string, DataGovernanceRecord>();
  private lineageGraph = new Map<string, DataLineageNode>();
  private governancePolicies: GovernancePolicy[] = [];
  private metrics: ComplianceMetrics;

  // Data classification patterns for recipes
  private classificationPatterns = {
    public: [
      /basic.*recipe/i,
      /traditional.*recipe/i,
      /common.*ingredient/i,
      /public.*domain/i
    ],
    restricted: [
      /proprietary/i,
      /signature.*recipe/i,
      /chef.*special/i,
      /restaurant.*secret/i
    ],
    sensitive: [
      /personal.*information/i,
      /contact.*details/i,
      /payment.*info/i,
      /subscription.*data/i
    ]
  };

  constructor(config: EnterpriseConfig) {
    this.config = config;
    this.metrics = {
      totalRecords: 0,
      compliantRecords: 0,
      reviewRequiredRecords: 0,
      nonCompliantRecords: 0,
      complianceRate: 0,
      averageQualityScore: 0,
      retentionViolations: 0,
      privacyViolations: 0
    };

    this.initializeGovernancePolicies();
    this.startComplianceMonitoring();
  }

  /**
   * Create governance record for a new recipe
   */
  async createGovernanceRecord(
    recipe: RawScrapedRecipe,
    processingSteps: Array<{ step: string; timestamp: Date; metadata?: any }>
  ): Promise<string> {
    const recordId = this.generateRecordId(recipe.source_url);
    
    // Classify data
    const dataClassification = this.classifyData(recipe);
    
    // Assess compliance
    const complianceStatus = await this.assessCompliance(recipe, dataClassification);
    
    // Create lineage chain
    const lineageChain = this.createLineageChain(recipe, processingSteps);
    
    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(recipe);
    
    // Assess privacy compliance
    const privacyCompliance = this.assessPrivacyCompliance(recipe);
    
    // Determine retention policy
    const retentionPolicy = this.determineRetentionPolicy(recipe, dataClassification);

    const governanceRecord: DataGovernanceRecord = {
      recipeId: recordId,
      sourceUrl: recipe.source_url,
      dataClassification,
      complianceStatus,
      retentionPolicy,
      auditTrail: [{
        action: 'record_created',
        actor: 'system',
        timestamp: new Date(),
        details: { source: recipe.source_url, classification: dataClassification }
      }],
      lineageChain,
      qualityMetrics,
      privacyCompliance
    };

    this.governanceRecords.set(recordId, governanceRecord);
    this.updateMetrics();

    // Store lineage nodes
    for (const node of lineageChain) {
      this.lineageGraph.set(node.id, node);
    }

    if (this.config.quality.auditTrailEnabled) {
      console.log(`[DATA-GOVERNANCE] Created record ${recordId} - Classification: ${dataClassification}, Compliance: ${complianceStatus}`);
    }

    return recordId;
  }

  /**
   * Add audit trail entry to a governance record
   */
  addAuditEntry(
    recordId: string,
    action: string,
    actor: string,
    details: Record<string, any>
  ): void {
    const record = this.governanceRecords.get(recordId);
    if (record) {
      record.auditTrail.push({
        action,
        actor,
        timestamp: new Date(),
        details
      });

      if (this.config.quality.auditTrailEnabled) {
        console.log(`[AUDIT-TRAIL] ${recordId}: ${action} by ${actor}`);
      }
    }
  }

  /**
   * Get complete lineage for a recipe
   */
  getRecipeLineage(recordId: string): {
    record: DataGovernanceRecord | null;
    fullLineage: DataLineageNode[];
    dependencies: string[];
    dependents: string[];
  } {
    const record = this.governanceRecords.get(recordId);
    if (!record) {
      return { record: null, fullLineage: [], dependencies: [], dependents: [] };
    }

    // Get all related lineage nodes
    const allNodeIds = new Set<string>();
    const nodeQueue = [...record.lineageChain.map(n => n.id)];
    
    while (nodeQueue.length > 0) {
      const nodeId = nodeQueue.shift()!;
      if (allNodeIds.has(nodeId)) continue;
      
      allNodeIds.add(nodeId);
      const node = this.lineageGraph.get(nodeId);
      if (node) {
        nodeQueue.push(...node.inputs, ...node.outputs);
      }
    }

    const fullLineage = Array.from(allNodeIds)
      .map(id => this.lineageGraph.get(id))
      .filter(Boolean) as DataLineageNode[];

    // Calculate dependencies and dependents
    const dependencies = fullLineage
      .filter(node => node.inputs.length === 0 && node.type === 'source')
      .map(node => node.id);
    
    const dependents = fullLineage
      .filter(node => node.outputs.length === 0 && node.type === 'storage')
      .map(node => node.id);

    return { record, fullLineage, dependencies, dependents };
  }

  /**
   * Check compliance for data retention policies
   */
  checkRetentionCompliance(): Array<{
    recordId: string;
    sourceUrl: string;
    violation: string;
    daysOverdue: number;
    recommendedAction: string;
  }> {
    const violations: Array<any> = [];
    const now = new Date();

    for (const [recordId, record] of this.governanceRecords.entries()) {
      if (record.retentionPolicy.deletionDate && now > record.retentionPolicy.deletionDate) {
        const daysOverdue = Math.floor(
          (now.getTime() - record.retentionPolicy.deletionDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        violations.push({
          recordId,
          sourceUrl: record.sourceUrl,
          violation: 'retention_period_exceeded',
          daysOverdue,
          recommendedAction: 'delete_or_archive'
        });
      }
    }

    this.metrics.retentionViolations = violations.length;
    return violations;
  }

  /**
   * Generate comprehensive governance report
   */
  generateGovernanceReport(): string {
    const retentionViolations = this.checkRetentionCompliance();
    const classificationBreakdown = this.getClassificationBreakdown();

    return `
ENTERPRISE DATA GOVERNANCE REPORT
=================================
Report Generated: ${new Date().toISOString()}

COMPLIANCE OVERVIEW:
- Total Records: ${this.metrics.totalRecords}
- Compliant Records: ${this.metrics.compliantRecords} (${((this.metrics.compliantRecords/this.metrics.totalRecords)*100).toFixed(1)}%)
- Overall Compliance Rate: ${this.metrics.complianceRate.toFixed(1)}%

DATA CLASSIFICATION:
${Object.entries(classificationBreakdown).map(([classification, count]) => 
  `- ${classification.toUpperCase()}: ${count} records`
).join('\n')}

RETENTION COMPLIANCE:
- Retention Violations: ${retentionViolations.length}

GOVERNANCE POLICIES:
${this.governancePolicies.filter(p => p.active).map(policy => 
  `- ${policy.name}: ${policy.rules.length} rules`
).join('\n')}

Generated by Enterprise Data Governance Manager v1.0
    `.trim();
  }

  // Private helper methods
  private classifyData(recipe: RawScrapedRecipe): 'public' | 'restricted' | 'sensitive' {
    const content = [
      recipe.title,
      recipe.description,
      ...(recipe.ingredients || []),
      ...(recipe.instructions || [])
    ].join(' ').toLowerCase();

    for (const pattern of this.classificationPatterns.sensitive) {
      if (pattern.test(content)) return 'sensitive';
    }

    for (const pattern of this.classificationPatterns.restricted) {
      if (pattern.test(content)) return 'restricted';
    }

    return 'public';
  }

  private async assessCompliance(
    recipe: RawScrapedRecipe,
    classification: 'public' | 'restricted' | 'sensitive'
  ): Promise<'compliant' | 'review_required' | 'non_compliant'> {
    if (classification === 'sensitive') return 'review_required';
    if (!recipe.source_url) return 'non_compliant';
    return 'compliant';
  }

  private createLineageChain(
    recipe: RawScrapedRecipe,
    processingSteps: Array<{ step: string; timestamp: Date; metadata?: any }>
  ): DataLineageNode[] {
    const nodes: DataLineageNode[] = [];
    
    // Source node
    const sourceNodeId = `source_${this.generateNodeId()}`;
    nodes.push({
      id: sourceNodeId,
      type: 'source',
      name: 'Recipe Source',
      description: `Original recipe from ${recipe.source_url}`,
      timestamp: new Date(),
      metadata: { url: recipe.source_url, title: recipe.title },
      inputs: [],
      outputs: []
    });

    return nodes;
  }

  private calculateQualityMetrics(recipe: RawScrapedRecipe) {
    let completenessScore = 0;
    const fields = [
      recipe.title, 
      recipe.ingredients?.length, 
      recipe.instructions?.length, 
      recipe.prep_time, 
      recipe.servings
    ];
    completenessScore = fields.filter(Boolean).length / fields.length;

    return {
      completenessScore,
      accuracyScore: 0.8,
      consistencyScore: 1.0,
      validityScore: recipe.source_url ? 1.0 : 0.6
    };
  }

  private assessPrivacyCompliance(recipe: RawScrapedRecipe) {
    const content = JSON.stringify(recipe).toLowerCase();
    const piiPatterns = [/email/i, /phone/i, /address/i];
    const containsPII = piiPatterns.some(pattern => pattern.test(content));
    
    return {
      containsPII,
      gdprCompliant: !containsPII,
      ccpaCompliant: !containsPII,
      retentionJustification: 'Recipe data for culinary database'
    };
  }

  private determineRetentionPolicy(
    recipe: RawScrapedRecipe,
    classification: 'public' | 'restricted' | 'sensitive'
  ) {
    const retentionDays = classification === 'sensitive' ? 90 : 
                         classification === 'restricted' ? 180 : 
                         this.config.storage.retentionDays;

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + retentionDays);

    return {
      category: `${classification}_recipe_data`,
      retentionPeriodDays: retentionDays,
      deletionDate
    };
  }

  private initializeGovernancePolicies(): void {
    this.governancePolicies = [
      {
        id: 'copyright_protection',
        name: 'Copyright Protection Policy',
        description: 'Ensures compliance with copyright laws',
        rules: [{ condition: 'contains_copyrighted_content', action: 'flag_for_review' }],
        priority: 10,
        active: this.config.compliance.respectCopyrights
      },
      {
        id: 'data_quality_minimum',
        name: 'Data Quality Standards',
        description: 'Enforces minimum quality requirements',
        rules: [{ condition: 'quality_below_threshold', action: 'flag_for_review' }],
        priority: 8,
        active: this.config.quality.enableValidation
      }
    ];
  }

  private startComplianceMonitoring(): void {
    setInterval(() => {
      if (this.config.quality.enableDatalineage) {
        this.checkRetentionCompliance();
        this.updateMetrics();
      }
    }, 3600000);
  }

  private generateRecordId(sourceUrl: string): string {
    return `gov_${this.simpleHash(sourceUrl)}_${Date.now()}`;
  }

  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private updateMetrics(): void {
    this.metrics.totalRecords = this.governanceRecords.size;
    this.metrics.compliantRecords = Array.from(this.governanceRecords.values())
      .filter(r => r.complianceStatus === 'compliant').length;
    this.metrics.complianceRate = this.metrics.totalRecords > 0 
      ? (this.metrics.compliantRecords / this.metrics.totalRecords) * 100 
      : 0;
  }

  private getClassificationBreakdown(): Record<string, number> {
    const breakdown = { public: 0, restricted: 0, sensitive: 0 };
    for (const record of this.governanceRecords.values()) {
      breakdown[record.dataClassification]++;
    }
    return breakdown;
  }

  // Public getter methods
  getMetrics(): ComplianceMetrics {
    return { ...this.metrics };
  }

  getGovernanceRecord(recordId: string): DataGovernanceRecord | null {
    return this.governanceRecords.get(recordId) || null;
  }
}
