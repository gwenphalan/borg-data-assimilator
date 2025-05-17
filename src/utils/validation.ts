import { z } from 'zod';

// Example Zod schema (can be expanded or modified)
export const exampleSchema = z.object({
  name: z.string().min(1, { message: "Name cannot be empty" }),
  email: z.string().email({ message: "Invalid email address" }),
  age: z.number().min(0, { message: "Age must be a positive number" }).optional(),
});

/**
 * Validates data against a Zod schema.
 * @param schema The Zod schema to validate against.
 * @param data The data to validate.
 * @returns An object with `success: true` and `data` if validation passes,
 *          or `success: false` and `errors` if validation fails.
 */
export function validateData<T extends z.ZodTypeAny>(schema: T, data: unknown): 
  | { success: true; data: z.infer<T> } 
  | { success: false; errors: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error.issues };
  }
}

// Example usage (can be removed or adapted):
// function testValidation() {
//   const testData = {
//     name: "Test User",
//     email: "test@example.com",
//     age: 30
//   };
// 
//   const validationResult = validateData(exampleSchema, testData);
// 
//   if (validationResult.success) {
//     console.log("Validation successful:", validationResult.data);
//   } else {
//     console.error("Validation failed:", validationResult.errors);
//   }
// 
//   const invalidData = {
//     name: "",
//     email: "not-an-email"
//   };
//   const invalidResult = validateData(exampleSchema, invalidData);
//   if (!invalidResult.success) {
//     console.error("Invalid data validation failed:", invalidResult.errors);
//   }
// }
// testValidation();

export default {
  exampleSchema, // Exporting the schema itself if it might be used directly
  validateData,
};

