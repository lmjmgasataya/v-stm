-- The "Usher" ministry is now called "Ushering" (MINISTRY_OPTIONS)
UPDATE "stm_members" SET "ministries" = array_replace("ministries", 'Usher', 'Ushering') WHERE 'Usher' = ANY("ministries");
