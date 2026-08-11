import { learningCards, lifeEvents, products } from '../data/content';
import type { LearningCard, LifeEvent, Product, ProductId } from '../types';

export const getProduct = (id: ProductId): Product => {
  const product = products.find((item) => item.id === id);
  if (!product) throw new Error(`알 수 없는 상품: ${id}`);
  return product;
};

export const getLearningCard = (id: string): LearningCard | undefined =>
  learningCards.find((card) => card.id === id);

export const getLifeEvent = (id: string): LifeEvent | undefined =>
  lifeEvents.find((event) => event.id === id);
