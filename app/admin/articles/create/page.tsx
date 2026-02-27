import { ArticleCreateForm } from './ArticleCreateForm';

export default function CreateArticlePage() {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Create New Guide or Article</h1>
      <p className="text-muted-foreground mb-8">
        Fill out the details below. The article will be created as a draft.
      </p>
      <ArticleCreateForm />
    </div>
  );
}