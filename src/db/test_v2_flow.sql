-- Integration Test Script for V2 AI-Native OKR System
-- Run after migration: cat src/db/test_v2_flow.sql | sudo -u postgres psql -d calendar_manager

-- Use the seed user
DO $$
DECLARE
  test_user_id UUID := '00000000-0000-0000-0000-000000000001';
  test_org_id UUID;
  test_cycle_id UUID;
  test_obj_id UUID;
  test_kr_id UUID;
  test_child_kr_id UUID;
  test_initiative_id UUID;
  test_task_id UUID;
BEGIN
  RAISE NOTICE '=== V2 Integration Test Start ===';

  -- 1. Create Organization
  INSERT INTO organizations (name, description, created_by)
  VALUES ('Test Org', 'Integration test org', test_user_id)
  RETURNING id INTO test_org_id;
  RAISE NOTICE '1. Created organization: %', test_org_id;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (test_org_id, test_user_id, 'owner');
  RAISE NOTICE '   Added user as owner';

  -- 2. Create Cycle
  INSERT INTO cycles (user_id, org_id, name, type, start_date, end_date)
  VALUES (test_user_id, test_org_id, 'Q1 2026', 'quarter', '2026-01-01', '2026-03-31')
  RETURNING id INTO test_cycle_id;
  RAISE NOTICE '2. Created cycle: %', test_cycle_id;

  -- 3. Create Objective
  INSERT INTO objectives (user_id, org_id, cycle_id, title, description, type, horizon, success_def)
  VALUES (test_user_id, test_org_id, test_cycle_id, 'Increase MRR', 'Grow monthly recurring revenue', 'work', 'quarter', 'MRR reaches $50k')
  RETURNING id INTO test_obj_id;
  RAISE NOTICE '3. Created objective: %', test_obj_id;

  -- 4. Create KR (root level)
  INSERT INTO key_results (user_id, objective_id, title, type, target, current, importance_weight)
  VALUES (test_user_id, test_obj_id, 'MRR reaches $50k', 'metric', '50000', '20000', 1)
  RETURNING id INTO test_kr_id;
  RAISE NOTICE '4. Created root KR: %', test_kr_id;

  -- 5. Create child KR
  INSERT INTO key_results (user_id, objective_id, title, type, target, current, parent_kr_id, root_kr_id, level, importance_weight)
  VALUES (test_user_id, test_obj_id, 'Close 10 enterprise deals', 'metric', '10', '3', test_kr_id, test_kr_id, 1, 0.7)
  RETURNING id INTO test_child_kr_id;
  RAISE NOTICE '5. Created child KR: % (parent: %)', test_child_kr_id, test_kr_id;

  -- 6. Create Initiative
  INSERT INTO initiatives (user_id, kr_id, title, description)
  VALUES (test_user_id, test_kr_id, 'Enterprise Sales Campaign', 'Focused outreach to enterprise accounts')
  RETURNING id INTO test_initiative_id;
  RAISE NOTICE '6. Created initiative: %', test_initiative_id;

  -- 7. Create Tasks
  INSERT INTO tasks (user_id, title, category, objective_id, kr_id, initiative_id, priority, due_date)
  VALUES (test_user_id, 'Prepare enterprise pitch deck', 'work', test_obj_id, test_kr_id, test_initiative_id, 'high', '2026-02-15')
  RETURNING id INTO test_task_id;
  RAISE NOTICE '7a. Created task: %', test_task_id;

  INSERT INTO tasks (user_id, title, category, objective_id, kr_id, initiative_id, priority, due_date, status, completed_at)
  VALUES (test_user_id, 'Research competitor pricing', 'work', test_obj_id, test_kr_id, test_initiative_id, 'critical', '2026-02-10', 'done', NOW())
  RETURNING id INTO test_task_id;
  RAISE NOTICE '7b. Created done task: %', test_task_id;

  INSERT INTO tasks (user_id, title, category, priority, blocking)
  VALUES (test_user_id, 'Fix personal website', 'personal', 'low', false);
  RAISE NOTICE '7c. Created unlinked personal task';

  INSERT INTO tasks (user_id, title, category, objective_id, kr_id, priority, due_date, blocking)
  VALUES (test_user_id, 'Deploy new pricing page', 'work', test_obj_id, test_kr_id, 'critical', '2026-02-12', true);
  RAISE NOTICE '7d. Created blocking task';

  -- 8. Verify data
  RAISE NOTICE '';
  RAISE NOTICE '=== Verification ===';
  RAISE NOTICE 'Organizations: %', (SELECT COUNT(*) FROM organizations WHERE created_by = test_user_id);
  RAISE NOTICE 'Org Members: %', (SELECT COUNT(*) FROM org_members WHERE user_id = test_user_id);
  RAISE NOTICE 'Cycles: %', (SELECT COUNT(*) FROM cycles WHERE user_id = test_user_id);
  RAISE NOTICE 'Objectives: %', (SELECT COUNT(*) FROM objectives WHERE user_id = test_user_id);
  RAISE NOTICE 'Key Results: %', (SELECT COUNT(*) FROM key_results WHERE user_id = test_user_id);
  RAISE NOTICE 'Initiatives: %', (SELECT COUNT(*) FROM initiatives WHERE user_id = test_user_id);
  RAISE NOTICE 'Tasks: %', (SELECT COUNT(*) FROM tasks WHERE user_id = test_user_id);
  RAISE NOTICE 'Child KR level: %', (SELECT level FROM key_results WHERE id = test_child_kr_id);
  RAISE NOTICE 'Child KR root_kr_id matches parent: %', (SELECT root_kr_id = test_kr_id FROM key_results WHERE id = test_child_kr_id);
  RAISE NOTICE '';
  RAISE NOTICE '=== V2 Integration Test Complete ===';
END $$;
