export type ItemId = string;

export type Item = {
  id: ItemId;
  title: string;
  createdAt: string;
};

export type CreateItemInput = {
  title: string;
};

export type UpdateItemInput = {
  title?: string;
};
