-- Employment offers and final website-only appointments must support the full
-- canonical LSCSO rank structure.
--
-- Canonical order:
-- Sheriff, Undersheriff, Major, Captain, 1st Lieutenant, Lieutenant,
-- Sergeant, Corporal, Master Deputy, Deputy III, Deputy II, Deputy, Recruit.

DO $migration$
DECLARE
  v_name text;
  v_sql text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'command_recruitment_application_action',
    'record_recruit_hire_website_only'
  ]
  LOOP
    SELECT pg_get_functiondef(p.oid)
      INTO v_sql
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = v_name
    LIMIT 1;

    IF v_sql IS NULL THEN
      RAISE EXCEPTION 'Required recruitment function % was not found.', v_name;
    END IF;

    v_sql := replace(
      v_sql,
      $old$('Major','Captain','1st Lieutenant','Lieutenant','Sergeant','Corporal','Master Deputy','Deputy III','Deputy II','Deputy','Recruit')$old$,
      $new$('Sheriff','Undersheriff','Major','Captain','1st Lieutenant','Lieutenant','Sergeant','Corporal','Master Deputy','Deputy III','Deputy II','Deputy','Recruit')$new$
    );

    IF v_name = 'command_recruitment_application_action' THEN
      v_sql := replace(
        v_sql,
        'Select a valid LSCSO rank below Undersheriff.',
        'Select a valid LSCSO rank.'
      );
    END IF;

    EXECUTE v_sql;
  END LOOP;
END
$migration$;
