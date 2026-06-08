import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query } from '../config/database';

const seedData = async () => {
  try {
    console.log('Starting data seeding...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    const usersResult = await query(
      `INSERT INTO users (username, password_hash, email, role, real_name, phone) VALUES 
       ('admin', $1, 'admin@example.com', 'admin', '系统管理员', '13800000001'),
       ('manager', $1, 'manager@example.com', 'manager', '项目经理', '13800000002'),
       ('member', $1, 'member@example.com', 'member', '项目成员', '13800000003')
       ON CONFLICT (username) DO NOTHING RETURNING id, username`,
      [hashedPassword]
    );
    console.log(`✓ Seeded ${usersResult.rows.length} users (default password: password123)`);

    let adminId, managerId, memberId;
    if (usersResult.rows.length > 0) {
      adminId = usersResult.rows.find(u => u.username === 'admin')?.id;
      managerId = usersResult.rows.find(u => u.username === 'manager')?.id;
      memberId = usersResult.rows.find(u => u.username === 'member')?.id;
    } else {
      const existingUsers = await query('SELECT id, username FROM users WHERE username IN ($1, $2, $3)', ['admin', 'manager', 'member']);
      adminId = existingUsers.rows.find(u => u.username === 'admin')?.id;
      managerId = existingUsers.rows.find(u => u.username === 'manager')?.id;
      memberId = existingUsers.rows.find(u => u.username === 'member')?.id;
    }

    const projectsResult = await query(
      `INSERT INTO projects (project_name, project_code, customer_name, description, status, start_date, end_date, project_manager_id, created_by) VALUES 
       ($2, 'PROJ001', '阿里巴巴集团', 'SaaS平台客户实施项目，包含需求调研、系统配置、测试上线等阶段', 'in_progress', '2024-01-01', '2024-06-30', $1, $1),
       ($2, 'PROJ002', '腾讯科技有限公司', 'ERP系统升级实施项目，覆盖财务、供应链、人力资源模块', 'in_progress', '2024-02-01', '2024-08-31', $1, $1),
       ($2, 'PROJ003', '字节跳动科技', '数据中台建设项目，包含数据采集、清洗、分析、可视化', 'planning', '2024-03-01', '2024-12-31', $1, $1)
       ON CONFLICT (project_code) DO NOTHING RETURNING id, project_name, project_code`,
      [managerId || adminId, adminId]
    );
    console.log(`✓ Seeded ${projectsResult.rows.length} projects`);

    let project1Id, project2Id, project3Id;
    if (projectsResult.rows.length > 0) {
      project1Id = projectsResult.rows.find(p => p.project_code === 'PROJ001')?.id;
      project2Id = projectsResult.rows.find(p => p.project_code === 'PROJ002')?.id;
      project3Id = projectsResult.rows.find(p => p.project_code === 'PROJ003')?.id;
    } else {
      const existingProjects = await query('SELECT id, project_code FROM projects WHERE project_code IN ($1, $2, $3)', ['PROJ001', 'PROJ002', 'PROJ003']);
      project1Id = existingProjects.rows.find(p => p.project_code === 'PROJ001')?.id;
      project2Id = existingProjects.rows.find(p => p.project_code === 'PROJ002')?.id;
      project3Id = existingProjects.rows.find(p => p.project_code === 'PROJ003')?.id;
    }

    if (project1Id) {
      await query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES 
         ($1, $2, 'manager'),
         ($1, $3, 'member')
         ON CONFLICT DO NOTHING`,
        [project1Id, managerId || adminId, memberId || adminId]
      );

      const milestonesResult = await query(
        `INSERT INTO milestones (project_id, milestone_name, milestone_code, description, planned_date, status, sort_order, created_by) VALUES 
         ($1, '需求调研完成', 'MS001', '完成客户需求调研，输出需求规格说明书', '2024-01-31', 'completed', 1, $2),
         ($1, '系统配置完成', 'MS002', '完成系统基础配置和个性化设置', '2024-02-29', 'completed', 2, $2),
         ($1, '用户培训完成', 'MS003', '完成关键用户和最终用户培训', '2024-03-31', 'in_progress', 3, $2),
         ($1, '用户验收测试', 'MS004', '完成UAT测试并修复所有缺陷', '2024-04-30', 'pending', 4, $2),
         ($1, '系统上线', 'MS005', '生产环境部署和数据迁移', '2024-05-31', 'pending', 5, $2),
         ($1, '项目验收', 'MS006', '最终验收和项目结项', '2024-06-30', 'pending', 6, $2)
         ON CONFLICT (milestone_code) DO NOTHING RETURNING id, milestone_name, sort_order`,
        [project1Id, adminId]
      );
      console.log(`✓ Seeded ${milestonesResult.rows.length} milestones for PROJ001`);

      let milestoneIds: Record<string, string> = {};
      if (milestonesResult.rows.length > 0) {
        milestonesResult.rows.forEach(m => {
          milestoneIds[m.sort_order] = m.id;
        });
      } else {
        const existingMilestones = await query('SELECT id, sort_order FROM milestones WHERE project_id = $1 ORDER BY sort_order', [project1Id]);
        existingMilestones.rows.forEach(m => {
          milestoneIds[m.sort_order] = m.id;
        });
      }

      if (milestoneIds[2] && milestoneIds[1]) {
        await query(
          `INSERT INTO milestone_dependencies (milestone_id, predecessor_id) VALUES 
           ($1, $2)
           ON CONFLICT DO NOTHING`,
          [milestoneIds[2], milestoneIds[1]]
        );
      }
      if (milestoneIds[3] && milestoneIds[2]) {
        await query(
          `INSERT INTO milestone_dependencies (milestone_id, predecessor_id) VALUES 
           ($1, $2)
           ON CONFLICT DO NOTHING`,
          [milestoneIds[3], milestoneIds[2]]
        );
      }
      if (milestoneIds[4] && milestoneIds[3]) {
        await query(
          `INSERT INTO milestone_dependencies (milestone_id, predecessor_id) VALUES 
           ($1, $2)
           ON CONFLICT DO NOTHING`,
          [milestoneIds[4], milestoneIds[3]]
        );
      }
      if (milestoneIds[5] && milestoneIds[4]) {
        await query(
          `INSERT INTO milestone_dependencies (milestone_id, predecessor_id) VALUES 
           ($1, $2)
           ON CONFLICT DO NOTHING`,
          [milestoneIds[5], milestoneIds[4]]
        );
      }
      if (milestoneIds[6] && milestoneIds[5]) {
        await query(
          `INSERT INTO milestone_dependencies (milestone_id, predecessor_id) VALUES 
           ($1, $2)
           ON CONFLICT DO NOTHING`,
          [milestoneIds[6], milestoneIds[5]]
        );
      }
      console.log('✓ Seeded milestone dependencies');

      const risksResult = await query(
        `INSERT INTO risks (project_id, risk_title, risk_code, description, risk_level, status, mitigation_measure, created_by) VALUES 
         ($1, '客户需求变更频繁', 'RISK001', '客户业务部门多，需求变更可能性大，可能影响项目进度', 'high', 'open', '建立需求变更控制流程，严格执行CR审批', $2),
         ($1, '关键用户参与度不足', 'RISK002', '客户方关键用户工作繁忙，参与项目时间有限', 'medium', 'monitoring', '提前与客户沟通，明确参与要求，设置激励机制', $2),
         ($1, '数据迁移质量风险', 'RISK003', '历史数据格式复杂，数据清洗难度大', 'high', 'open', '制定详细的数据迁移方案，提前进行数据质量检查', $2),
         ($1, '集成接口稳定性', 'RISK004', '与第三方系统集成，接口稳定性存在风险', 'medium', 'open', '进行充分的接口测试，准备降级方案', $2)
         ON CONFLICT (risk_code) DO NOTHING RETURNING id`,
        [project1Id, adminId]
      );
      console.log(`✓ Seeded ${risksResult.rows.length} risks for PROJ001`);

      const meetingsResult = await query(
        `INSERT INTO meeting_minutes (project_id, meeting_title, meeting_date, location, content, created_by) VALUES 
         ($1, '项目启动会', '2024-01-05 10:00:00', '客户现场会议室A', '项目启动，介绍项目目标、范围、团队组成和工作计划', $2),
         ($1, '需求调研讨论会', '2024-01-15 14:00:00', '线上会议', '讨论业务流程和功能需求，确认需求范围', $2),
         ($1, '系统配置评审会', '2024-02-25 09:00:00', '客户现场会议室B', '评审系统配置方案，确认参数设置', $2)
         ON CONFLICT DO NOTHING RETURNING id`,
        [project1Id, adminId]
      );
      console.log(`✓ Seeded ${meetingsResult.rows.length} meeting minutes for PROJ001`);

      if (milestoneIds[1]) {
        const acceptanceResult = await query(
          `INSERT INTO acceptance_forms (project_id, milestone_id, acceptance_code, acceptance_title, acceptance_content, status, applicant_id, submit_date) VALUES 
           ($1, $2, 'ACCEPT001', '需求调研验收单', '需求调研工作已完成，输出《需求规格说明书V1.0》，经双方确认无误。', 'accepted', $3, '2024-01-31 10:00:00')
           ON CONFLICT (acceptance_code) DO NOTHING RETURNING id`,
          [project1Id, milestoneIds[1], adminId]
        );
        console.log(`✓ Seeded ${acceptanceResult.rows.length} acceptance forms for PROJ001`);
      }
    }

    console.log('\n✓ Data seeding completed successfully!');
    console.log('\nDefault accounts:');
    console.log('  admin / password123 (管理员)');
    console.log('  manager / password123 (项目经理)');
    console.log('  member / password123 (项目成员)');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Data seeding failed:', error);
    process.exit(1);
  }
};

seedData();
