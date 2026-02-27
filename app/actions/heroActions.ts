"use server";

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { revalidatePath } from 'next/cache';

// Imports for services
import { userService, heroService } from '@/lib/services';

// Imports for security
import { auth } from "@/auth";

// Imports for your custom content generator
import { HeroMarkdownGenerator } from '@/types/hero-content-framework';

// ============================================================================
// YOUR ORIGINAL ACTION (Now with a SuperAdmin security check for consistency)
// This action saves structured data to the 'heroes' collection in MongoDB.
// ============================================================================
export async function updateHeroContent(heroSlug: string, formData: FormData) {
  try {
    // --- Security Check ---
    const session = await auth();

    if (!session?.user?.id) throw new Error("Authentication required.");

    // Check Super Admin role using service layer
    const roleCheck = await userService.hasRole(session.user.id, 'isSuperAdmin');
    if (!roleCheck.success || !roleCheck.data) {
      throw new Error("Authorization failed. Super Admin role required.");
    }
    // --- End Security Check ---

    const heroData = {
      introduction: formData.get('introduction') as string,
      generalStrategy: formData.get('generalStrategy') as string,
      featuredWeapons: formData.getAll('featuredWeapons').filter(Boolean) as string[],
      featuredEquipment: formData.getAll('featuredEquipment').filter(Boolean) as string[],
      featuredAttacks: formData.getAll('featuredAttacks').filter(Boolean) as string[],
      featuredNonAttacks: formData.getAll('featuredNonAttacks').filter(Boolean) as string[],
      supportingCards: formData.getAll('supportingCards').filter(Boolean) as string[],
    };

    // Use hero service to upsert content
    const result = await heroService.upsertHeroContent(heroSlug, heroData);

    if (!result.success) {
      throw new Error(result.error || 'Failed to save hero content');
    }

    revalidatePath(`/heroes/${heroSlug}`);
    revalidatePath('/admin/articles');

    return { success: true, message: 'Hero content saved to database!' };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message: `Failed to save: ${message}` };
  }
}


// ============================================================================
// THE NEW ACTION
// This action saves the hero content as a .mdx file in your project directory.
// ============================================================================
export async function saveHeroContent(heroSlug: string, config: any) {
  try {
    // --- Security Check ---
    const session = await auth();
    if (!session?.user?.id) throw new Error("Authentication required.");

    // Check Super Admin role using service layer
    const roleCheck = await userService.hasRole(session.user.id, 'isSuperAdmin');
    if (!roleCheck.success || !roleCheck.data) {
      throw new Error("Authorization failed. Super Admin role required.");
    }
    // --- End Security Check ---

    const generator = new HeroMarkdownGenerator(config);
    const mdxContent = generator.generate();

    const frontmatter = {
      title: config.title,
      subtitle: config.subtitle,
    };

    const fileContent = matter.stringify(mdxContent, frontmatter);

    const contentDirectory = path.join(process.cwd(), 'content', 'heroes');
    await fs.mkdir(contentDirectory, { recursive: true });
    const filePath = path.join(contentDirectory, `${heroSlug}.mdx`);

    await fs.writeFile(filePath, fileContent);

    revalidatePath(`/heroes/${heroSlug}`);
    revalidatePath('/admin/articles');

    return { success: true, message: 'Hero guide MDX file saved successfully!' };
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("[saveHeroContent Action Error]:", message);
    return { success: false, message: `Failed to save: ${message}` };
  }
}
// "use server";

// import { revalidatePath } from 'next/cache';
// import connectToDatabase from '@/lib/mongodb';
// import Hero from '@/models/Hero';
// // You could add a server-side check here to ensure the caller is a SuperAdmin for extra security

// export async function updateHeroContent(heroSlug: string, formData: FormData) {
//   try {
//     await connectToDatabase();

//     const heroData = {
//       introduction: formData.get('introduction') as string,
//       generalStrategy: formData.get('generalStrategy') as string,
//       featuredWeapons: formData.getAll('featuredWeapons').filter(Boolean) as string[],
//       featuredEquipment: formData.getAll('featuredEquipment').filter(Boolean) as string[],
//       featuredAttacks: formData.getAll('featuredAttacks').filter(Boolean) as string[],
//       featuredNonAttacks: formData.getAll('featuredNonAttacks').filter(Boolean) as string[],
//       supportingCards: formData.getAll('supportingCards').filter(Boolean) as string[],
//     };

//     await Hero.findOneAndUpdate({ heroSlug }, heroData, { upsert: true });

//     // Revalidate the public hero page so changes are visible immediately
//     revalidatePath(`/heroes/${heroSlug}`);
//     // Also revalidate the admin dashboard to update the "Content exists" status
//     revalidatePath('/admin/heroes');
    
//     return { success: true, message: 'Hero content saved!' };
//   } catch (error) {
//     const message = error instanceof Error ? error.message : "Unknown error";
//     return { success: false, message: `Failed to save: ${message}` };
//   }
// }