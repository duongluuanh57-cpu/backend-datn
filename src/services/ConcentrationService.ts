import { Concentration } from '../models/Concentration.ts';
import type { IConcentration } from '../models/Concentration.ts';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/[^\w\-]+/g, '') // remove all non-word chars
    .replace(/\--+/g, '-') // replace multiple - with single -
    .replace(/^-+/, '') // trim - from start
    .replace(/-+$/, ''); // trim - from end
}

export class ConcentrationService {
  /**
   * Fetch all concentrations for the tenant
   */
  static async getAllConcentrations(tenantId: string): Promise<IConcentration[]> {
    let list = await Concentration.find({ tenantId }).sort({ name: 1 });
    if (list.length === 0) {
      console.log(`🌱 [Concentration Seeding] Seeding default concentrations for tenant: ${tenantId}`);
      try {
        const defaults = [
          { name: 'Parfum', slug: 'parfum', status: 'active', tenantId },
          { name: 'Eau de Parfum (EDP)', slug: 'edp', status: 'active', tenantId },
          { name: 'Eau de Toilette (EDT)', slug: 'edt', status: 'active', tenantId },
          { name: 'Eau de Cologne (EDC)', slug: 'edc', status: 'active', tenantId },
          { name: 'Extrait de Parfum', slug: 'extrait', status: 'active', tenantId }
        ];
        await Concentration.insertMany(defaults);
        list = await Concentration.find({ tenantId }).sort({ name: 1 });
      } catch (err) {
        console.error('❌ Error seeding default concentrations:', err);
      }
    }
    return list;
  }

  /**
   * Fetch details of a concentration by ID
   */
  static async getConcentrationById(id: string, tenantId: string): Promise<IConcentration | null> {
    return await Concentration.findOne({ _id: id, tenantId });
  }

  /**
   * Create a new concentration
   */
  static async createConcentration(data: Partial<IConcentration>, tenantId: string): Promise<IConcentration> {
    const slug = data.slug || slugify(data.name || '');
    const item = new Concentration({
      ...data,
      slug,
      tenantId
    });
    return await item.save();
  }

  /**
   * Update concentration info
   */
  static async updateConcentration(id: string, data: Partial<IConcentration>, tenantId: string): Promise<IConcentration | null> {
    const updateData = { ...data };
    if (data.name && !data.slug) {
      updateData.slug = slugify(data.name);
    }
    return await Concentration.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updateData },
      { new: true }
    );
  }

  /**
   * Delete concentration from the system
   */
  static async deleteConcentration(id: string, tenantId: string): Promise<boolean> {
    const result = await Concentration.deleteOne({ _id: id, tenantId });
    return result.deletedCount > 0;
  }
}
