// lib/mdx-content.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

/**
 * A generic function to read a specific MDX file from any content subdirectory.
 * @param contentType The subdirectory within 'content' (e.g., 'heroes', 'articles').
 * @param slug The name of the file without the .mdx extension.
 */
export function getContentBySlug(contentType: string, slug: string) {
  const contentDirectory = path.join(process.cwd(), 'content', contentType);
  const filePath = path.join(contentDirectory, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(source); // 'gray-matter' parses the frontmatter
  return { frontmatter: data, content };
}

/**
 * A generic function to get all slugs from a content subdirectory.
 * This will be used by generateStaticParams.
 * @param contentType The subdirectory within 'content' (e.g., 'heroes', 'articles').
 */
export function getAllContentSlugs(contentType: string) {
  try {
    const contentDirectory = path.join(process.cwd(), 'content', contentType);
    const files = fs.readdirSync(contentDirectory);
    
    return files
      .filter(file => file.endsWith('.mdx'))
      .map(file => ({
        slug: file.replace('.mdx', ''),
      }));
  } catch (error) {
    // If the directory doesn't exist, return an empty array.
    console.warn(`Could not read directory: content/${contentType}`);
    return [];
  }
}



/**
 * A new function to get the frontmatter and slug for ALL files in a content type.
 * This is perfect for creating listing pages.
 * @param contentType The subdirectory within 'content' (e.g., 'articles').
 */
export function getAllContentMetadata(contentType: string) {
    try {
      const contentDirectory = path.join(process.cwd(), 'content', contentType);
      const files = fs.readdirSync(contentDirectory);
      
      const allMetadata = files
        .filter(file => file.endsWith('.mdx'))
        .map(file => {
          const filePath = path.join(contentDirectory, file);
          const source = fs.readFileSync(filePath, 'utf8');
          const { data } = matter(source); // We only need the frontmatter (data)
          
          return {
            slug: file.replace('.mdx', ''),
            frontmatter: data,
          };
        });
  
      // Optional: Sort articles by date, newest first
      // This requires a 'date' field in your MDX frontmatter
      return allMetadata.sort((a, b) => {
        if (a.frontmatter.date && b.frontmatter.date) {
          return new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime();
        }
        return 0;
      });
  
    } catch (error) {
      console.warn(`Could not read directory: content/${contentType}`);
      return [];
    }
  }

/**
 * A NEW function to get combined metadata from multiple content types.
 * @param contentTypes An array of content type directories (e.g., ['heroes', 'articles']).
 */
export function getCombinedContentMetadata(contentTypes: string[]) {
    let allContent: any[] = [];
  
    for (const contentType of contentTypes) {
      try {
        const contentDirectory = path.join(process.cwd(), 'content', contentType);
        const files = fs.readdirSync(contentDirectory);
        
        const contentMetadata = files
          .filter(file => file.endsWith('.mdx'))
          .map(file => {
            const filePath = path.join(contentDirectory, file);
            const source = fs.readFileSync(filePath, 'utf8');
            const { data } = matter(source);
            
            // --- THIS IS THE FIX ---
            // More robust logic to determine the singular content type
            let type = contentType;
            if (contentType === 'heroes') {
              type = 'hero';
            } else if (contentType.endsWith('s')) {
              type = contentType.slice(0, -1);
            }
            // --- END FIX ---
  
            return {
              slug: file.replace('.mdx', ''),
              frontmatter: data,
              type: type, // Use the new, corrected type
            };
          });
        
        allContent = [...allContent, ...contentMetadata];
  
      } catch (error) {
        console.warn(`Could not read directory: content/${contentType}`);
      }
    }
  
    // Sort all combined content by date, newest first (this part is fine)
    return allContent.sort((a, b) => {
      if (a.frontmatter.date && b.frontmatter.date) {
        return new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime();
      }
      return 0;
    });
  }