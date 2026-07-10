-- Cavite Institute PMS Database Backup
-- Generated: 2026-07-09T02:20:28.383Z

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';

DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `module` varchar(50) NOT NULL,
  `description` text,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_activity_created` (`created_at`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=164 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (1, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 09:45:33');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (2, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 09:57:56');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (3, 1, 'CREATE', 'Category', 'Added category ICT', '::1', '2026-07-08 10:19:33');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (4, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 10:39:40');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (5, 1, 'UPDATE', 'Category', 'Updated category ICT', '::1', '2026-07-08 10:39:53');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (6, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 10:40:01');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (7, 1, 'UPDATE', 'Category', 'Updated category Engineering', '::1', '2026-07-08 10:40:01');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (8, 1, 'UPDATE', 'Category', 'Updated category Engineering', '::1', '2026-07-08 10:40:10');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (9, 1, 'UPDATE', 'Category', 'Updated category Senior High School', '::1', '2026-07-08 10:40:22');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (10, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 10:41:22');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (11, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 10:44:11');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (12, 1, 'UPDATE', 'Category', 'Updated category Engineering', '::1', '2026-07-08 10:44:11');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (13, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 10:44:49');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (14, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 10:54:08');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (15, 1, 'CREATE', 'Location', 'Added location Com Lab 1', '::1', '2026-07-08 10:54:33');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (16, 1, 'LOGOUT', 'Auth', 'System Administrator logged out', '::1', '2026-07-08 10:55:11');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (17, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 10:55:47');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (18, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:02:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (19, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-08 11:02:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (20, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:02:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (21, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:02:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (22, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:02:28');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (23, 1, 'UPDATE', 'Category', 'Updated category Engineering', '::1', '2026-07-08 11:02:28');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (24, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:02:28');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (25, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:02:29');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (26, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:03:05');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (27, 1, 'CREATE', 'User', 'Added user admcreated_1783479785495', '::1', '2026-07-08 11:03:05');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (28, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:03:05');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (29, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-08 11:03:06');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (30, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:03:06');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (31, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:03:06');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (32, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-08 11:03:06');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (33, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:03:06');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (34, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:03:28');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (35, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:03:28');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (36, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:03:28');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (37, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-08 11:03:29');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (38, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:03:29');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (39, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:03:29');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (40, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:03:29');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (41, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-08 11:03:29');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (42, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:03:30');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (43, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:03:30');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (44, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:04:11');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (45, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:04:12');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (46, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:05:34');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (47, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:05:34');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (48, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:05:34');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (49, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-08 11:05:34');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (50, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:05:34');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (51, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:05:34');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (52, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:05:35');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (53, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-08 11:05:35');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (54, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:05:35');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (55, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-08 11:05:35');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (56, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:11:58');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (57, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:11:59');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (58, 1, 'CREATE', 'Inventory', 'Added item ENG-001', '::1', '2026-07-08 11:11:59');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (59, 1, 'UPDATE', 'Inventory', 'Updated item ENG-001', '::1', '2026-07-08 11:11:59');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (60, 1, 'ARCHIVE', 'Inventory', 'Archived item ENG-001', '::1', '2026-07-08 11:11:59');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (61, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:11:59');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (62, 1, 'CREATE', 'Inventory', 'Added item ENG-002', '::1', '2026-07-08 11:11:59');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (63, 1, 'UPDATE', 'Inventory', 'Updated item ENG-002', '::1', '2026-07-08 11:11:59');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (64, 1, 'ARCHIVE', 'Inventory', 'Archived item ENG-002', '::1', '2026-07-08 11:11:59');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (65, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:11:59');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (66, 1, 'CREATE', 'Inventory', 'Added item ENG-003', '::1', '2026-07-08 11:12:00');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (67, 1, 'UPDATE', 'Inventory', 'Updated item ENG-003', '::1', '2026-07-08 11:12:00');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (68, 1, 'ARCHIVE', 'Inventory', 'Archived item ENG-003', '::1', '2026-07-08 11:12:00');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (69, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:12:00');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (70, 1, 'CREATE', 'Inventory', 'Added item ENG-004', '::1', '2026-07-08 11:12:00');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (71, 1, 'CREATE', 'Inventory', 'Added item ENG-005', '::1', '2026-07-08 11:12:00');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (72, 1, 'ARCHIVE', 'Inventory', 'Archived item ENG-004', '::1', '2026-07-08 11:12:00');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (73, 1, 'ARCHIVE', 'Inventory', 'Archived item ENG-005', '::1', '2026-07-08 11:12:00');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (74, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:13:02');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (75, 1, 'CREATE', 'Inventory', 'Added item ENG-006', '::1', '2026-07-08 11:13:02');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (76, 1, 'ARCHIVE', 'Inventory', 'Archived item ENG-006', '::1', '2026-07-08 11:13:02');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (77, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:13:24');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (78, 1, 'CREATE', 'Inventory', 'Added item ENG-007', '::1', '2026-07-08 11:13:24');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (79, 1, 'CREATE', 'Inventory', 'Added item ENG-008', '::1', '2026-07-08 11:13:24');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (80, 1, 'ARCHIVE', 'Inventory', 'Archived item ENG-007', '::1', '2026-07-08 11:13:24');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (81, 1, 'ARCHIVE', 'Inventory', 'Archived item ENG-008', '::1', '2026-07-08 11:13:24');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (82, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-08 11:18:53');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (83, 1, 'ARCHIVE', 'User', 'Archived user admcreated_1783479785495', '::1', '2026-07-08 11:19:03');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (84, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-09 08:20:36');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (85, 1, 'CREATE', 'Inventory', 'SMP: Seeded sample inventory records for QA testing', NULL, '2026-07-09 08:26:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (86, 2, 'BORROW', 'Borrow', 'SMP: Created borrow request BRW-SMP-004', NULL, '2026-07-09 08:26:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (87, 3, 'TRANSFER', 'Transfer', 'SMP: Requested transfer TRF-SMP-001', NULL, '2026-07-09 08:26:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (88, 4, 'MAINTENANCE', 'Maintenance', 'SMP: Reported maintenance issue MNT-SMP-001', NULL, '2026-07-09 08:26:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (89, 5, 'RETURN', 'Return', 'SMP: Processed return RTN-SMP-001', NULL, '2026-07-09 08:26:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (90, 1, 'APPROVE', 'Borrow', 'SMP: Approved borrow request BRW-SMP-002', NULL, '2026-07-09 08:26:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (91, 2, 'INSPECT', 'Disposal', 'SMP: Inspected disposal request DSP-SMP-002', NULL, '2026-07-09 08:26:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (92, 1, 'LOGIN', 'Auth', 'SMP: Administrator session for sample data verification', NULL, '2026-07-09 08:26:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (93, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:27:03');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (94, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-09 08:27:03');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (95, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:27:03');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (96, 4, 'LOGIN', 'Auth', 'Engineering Custodian logged in', '::1', '2026-07-09 08:27:03');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (97, 5, 'LOGIN', 'Auth', 'Senior High School Custodian logged in', '::1', '2026-07-09 08:27:04');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (98, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:27:04');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (99, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:27:33');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (100, 2, 'LOGOUT', 'Auth', 'Test Property Manager logged out', '::1', '2026-07-09 08:29:08');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (101, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:29:33');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (102, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:37:42');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (103, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:37:42');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (104, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:38:26');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (105, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:39:14');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (106, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-09 08:39:14');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (107, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:39:14');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (108, 4, 'LOGIN', 'Auth', 'Engineering Custodian logged in', '::1', '2026-07-09 08:39:14');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (109, 5, 'LOGIN', 'Auth', 'Senior High School Custodian logged in', '::1', '2026-07-09 08:39:14');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (110, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:41:03');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (111, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:48:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (112, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-09 08:48:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (113, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:48:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (114, 4, 'LOGIN', 'Auth', 'Engineering Custodian logged in', '::1', '2026-07-09 08:48:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (115, 5, 'LOGIN', 'Auth', 'Senior High School Custodian logged in', '::1', '2026-07-09 08:48:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (116, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:48:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (117, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:48:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (118, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:49:37');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (119, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-09 08:49:37');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (120, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:49:37');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (121, 4, 'LOGIN', 'Auth', 'Engineering Custodian logged in', '::1', '2026-07-09 08:49:37');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (122, 5, 'LOGIN', 'Auth', 'Senior High School Custodian logged in', '::1', '2026-07-09 08:49:37');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (123, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:49:37');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (124, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:49:38');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (125, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:49:56');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (126, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:49:56');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (127, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:50:24');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (128, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:57:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (129, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 08:57:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (130, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-09 08:57:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (131, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 08:57:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (132, 3, 'LOGOUT', 'Auth', 'ICT Custodian logged out', '::1', '2026-07-09 08:59:57');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (133, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 09:00:04');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (134, 1, 'LOGOUT', 'Auth', 'System Administrator logged out', '::1', '2026-07-09 09:04:22');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (135, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-09 09:04:40');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (136, 2, 'LOGOUT', 'Auth', 'Test Property Manager logged out', '::1', '2026-07-09 09:05:06');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (137, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:05:23');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (138, 3, 'LOGOUT', 'Auth', 'ICT Custodian logged out', '::1', '2026-07-09 09:09:14');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (139, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 09:09:21');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (140, 1, 'LOGOUT', 'Auth', 'System Administrator logged out', '::1', '2026-07-09 09:10:10');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (141, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:10:27');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (142, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:15:38');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (143, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:15:38');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (144, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:15:38');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (145, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 09:16:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (146, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-09 09:16:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (147, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:16:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (148, 4, 'LOGIN', 'Auth', 'Engineering Custodian logged in', '::1', '2026-07-09 09:16:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (149, 5, 'LOGIN', 'Auth', 'Senior High School Custodian logged in', '::1', '2026-07-09 09:16:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (150, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:16:43');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (151, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 09:19:01');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (152, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:19:02');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (153, 4, 'LOGIN', 'Auth', 'Engineering Custodian logged in', '::1', '2026-07-09 09:19:02');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (154, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:20:40');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (155, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 09:35:37');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (156, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:35:37');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (157, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 09:35:56');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (158, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 09:35:56');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (159, 3, 'LOGOUT', 'Auth', 'ICT Custodian logged out', '::1', '2026-07-09 10:12:33');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (160, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 10:12:39');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (161, 1, 'LOGIN', 'Auth', 'System Administrator logged in', '::1', '2026-07-09 10:20:28');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (162, 2, 'LOGIN', 'Auth', 'Test Property Manager logged in', '::1', '2026-07-09 10:20:28');
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `module`, `description`, `ip_address`, `created_at`) VALUES (163, 3, 'LOGIN', 'Auth', 'ICT Custodian logged in', '::1', '2026-07-09 10:20:28');

DROP TABLE IF EXISTS `borrow_items`;
CREATE TABLE `borrow_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `borrow_transaction_id` int NOT NULL,
  `inventory_item_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `borrow_transaction_id` (`borrow_transaction_id`),
  KEY `inventory_item_id` (`inventory_item_id`),
  CONSTRAINT `borrow_items_ibfk_1` FOREIGN KEY (`borrow_transaction_id`) REFERENCES `borrow_transactions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `borrow_items_ibfk_2` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `borrow_items` (`id`, `borrow_transaction_id`, `inventory_item_id`, `quantity`, `created_at`) VALUES (1, 1, 12, 1, '2026-07-09 08:26:43');
INSERT INTO `borrow_items` (`id`, `borrow_transaction_id`, `inventory_item_id`, `quantity`, `created_at`) VALUES (2, 2, 16, 1, '2026-07-09 08:26:43');
INSERT INTO `borrow_items` (`id`, `borrow_transaction_id`, `inventory_item_id`, `quantity`, `created_at`) VALUES (3, 3, 24, 1, '2026-07-09 08:26:43');
INSERT INTO `borrow_items` (`id`, `borrow_transaction_id`, `inventory_item_id`, `quantity`, `created_at`) VALUES (4, 4, 20, 1, '2026-07-09 08:26:43');
INSERT INTO `borrow_items` (`id`, `borrow_transaction_id`, `inventory_item_id`, `quantity`, `created_at`) VALUES (5, 5, 11, 2, '2026-07-09 08:26:43');
INSERT INTO `borrow_items` (`id`, `borrow_transaction_id`, `inventory_item_id`, `quantity`, `created_at`) VALUES (6, 6, 16, 5, '2026-07-09 08:26:43');
INSERT INTO `borrow_items` (`id`, `borrow_transaction_id`, `inventory_item_id`, `quantity`, `created_at`) VALUES (7, 7, 20, 1, '2026-07-09 08:26:43');

DROP TABLE IF EXISTS `borrow_transactions`;
CREATE TABLE `borrow_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_code` varchar(50) NOT NULL,
  `borrower_id` int NOT NULL,
  `borrower_name` varchar(100) NOT NULL,
  `borrower_department` varchar(100) DEFAULT NULL,
  `purpose` text,
  `borrow_date` date NOT NULL,
  `expected_return_date` date DEFAULT NULL,
  `status` enum('Pending','Approved','Rejected','Borrowed','Returned','Overdue') DEFAULT 'Pending',
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_code` (`transaction_code`),
  KEY `borrower_id` (`borrower_id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_borrow_status` (`status`),
  KEY `idx_borrow_date` (`borrow_date`),
  CONSTRAINT `borrow_transactions_ibfk_1` FOREIGN KEY (`borrower_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `borrow_transactions_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `borrow_transactions` (`id`, `transaction_code`, `borrower_id`, `borrower_name`, `borrower_department`, `purpose`, `borrow_date`, `expected_return_date`, `status`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`) VALUES (1, 'BRW-SMP-001', 3, 'ICT Custodian', 'ICT Department', 'Faculty training on new LMS platform', '2025-06-01', '2025-06-15', 'Pending', NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `borrow_transactions` (`id`, `transaction_code`, `borrower_id`, `borrower_name`, `borrower_department`, `purpose`, `borrow_date`, `expected_return_date`, `status`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`) VALUES (2, 'BRW-SMP-002', 4, 'Engineering Custodian', 'Engineering Department', 'Skills demonstration for Grade 12 students', '2025-06-05', '2025-06-20', 'Approved', 1, '2025-06-05 09:00:00', NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `borrow_transactions` (`id`, `transaction_code`, `borrower_id`, `borrower_name`, `borrower_department`, `purpose`, `borrow_date`, `expected_return_date`, `status`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`) VALUES (3, 'BRW-SMP-003', 5, 'Senior High School Custodian', 'Senior High School', 'Science practical exam setup', '2025-06-10', '2025-06-25', 'Borrowed', 1, '2025-06-10 09:00:00', NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `borrow_transactions` (`id`, `transaction_code`, `borrower_id`, `borrower_name`, `borrower_department`, `purpose`, `borrow_date`, `expected_return_date`, `status`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`) VALUES (4, 'BRW-SMP-004', 2, 'Test Property Manager', 'Property Management Office', 'SHS orientation AV presentation', '2025-05-15', '2025-05-30', 'Returned', 1, '2025-05-15 09:00:00', NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `borrow_transactions` (`id`, `transaction_code`, `borrower_id`, `borrower_name`, `borrower_department`, `purpose`, `borrow_date`, `expected_return_date`, `status`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`) VALUES (5, 'BRW-SMP-005', 3, 'ICT Custodian', 'ICT Department', 'Network infrastructure audit presentation', '2025-05-01', '2025-05-14', 'Returned', 1, '2025-05-01 09:00:00', NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `borrow_transactions` (`id`, `transaction_code`, `borrower_id`, `borrower_name`, `borrower_department`, `purpose`, `borrow_date`, `expected_return_date`, `status`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`) VALUES (6, 'BRW-SMP-006', 4, 'Engineering Custodian', 'Engineering Department', 'Engineering week equipment showcase', '2025-06-20', '2025-07-05', 'Rejected', 1, '2025-06-20 09:00:00', 'Requested quantity exceeds available stock', '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `borrow_transactions` (`id`, `transaction_code`, `borrower_id`, `borrower_name`, `borrower_department`, `purpose`, `borrow_date`, `expected_return_date`, `status`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`) VALUES (7, 'BRW-SMP-007', 5, 'Senior High School Custodian', 'Senior High School', 'Classroom multimedia lesson', '2025-04-01', '2025-04-15', 'Overdue', 1, '2025-04-01 09:00:00', NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43');

DROP TABLE IF EXISTS `component_replacements`;
CREATE TABLE `component_replacements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parent_asset_id` int NOT NULL,
  `old_component_name` varchar(200) NOT NULL,
  `new_inventory_item_id` int DEFAULT NULL,
  `new_component_name` varchar(200) DEFAULT NULL,
  `replaced_by` int NOT NULL,
  `replacement_date` date NOT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `new_inventory_item_id` (`new_inventory_item_id`),
  KEY `replaced_by` (`replaced_by`),
  KEY `idx_component_parent` (`parent_asset_id`),
  CONSTRAINT `component_replacements_ibfk_1` FOREIGN KEY (`parent_asset_id`) REFERENCES `inventory_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `component_replacements_ibfk_2` FOREIGN KEY (`new_inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `component_replacements_ibfk_3` FOREIGN KEY (`replaced_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `component_replacements` (`id`, `parent_asset_id`, `old_component_name`, `new_inventory_item_id`, `new_component_name`, `replaced_by`, `replacement_date`, `notes`, `created_at`) VALUES (1, 11, 'Original 8GB RAM', 14, NULL, 3, '2025-05-10', 'Upgraded laptop RAM from 8GB to 16GB using stock module', '2026-07-09 08:26:43');

DROP TABLE IF EXISTS `database_backups`;
CREATE TABLE `database_backups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `file_name` varchar(255) NOT NULL,
  `file_size` bigint NOT NULL DEFAULT '0',
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `file_name` (`file_name`),
  KEY `idx_backups_created` (`created_at` DESC),
  KEY `created_by` (`created_by`),
  CONSTRAINT `database_backups_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `code` varchar(20) NOT NULL,
  `description` text,
  `department_head` varchar(100) DEFAULT NULL,
  `custodian_id` int DEFAULT NULL,
  `status` enum('Active','Inactive') DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `archived_at` timestamp NULL DEFAULT NULL,
  `archived_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `code` (`code`),
  KEY `custodian_id` (`custodian_id`),
  KEY `idx_departments_archived` (`is_archived`,`archived_at`),
  CONSTRAINT `departments_ibfk_1` FOREIGN KEY (`custodian_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `departments` (`id`, `name`, `code`, `description`, `department_head`, `custodian_id`, `status`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (1, 'ICT', 'ICT', NULL, NULL, 3, 'Active', '2026-07-08 10:19:33', '2026-07-08 10:39:53', 0, NULL, NULL);
INSERT INTO `departments` (`id`, `name`, `code`, `description`, `department_head`, `custodian_id`, `status`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (2, 'Engineering', 'ENG', 'Engineering department', NULL, 4, 'Active', '2026-07-08 10:33:35', '2026-07-08 10:40:01', 0, NULL, NULL);
INSERT INTO `departments` (`id`, `name`, `code`, `description`, `department_head`, `custodian_id`, `status`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (3, 'Senior High School', 'SHS', 'Senior High School department', NULL, 5, 'Active', '2026-07-08 10:33:35', '2026-07-08 10:40:22', 0, NULL, NULL);

DROP TABLE IF EXISTS `disposal_requests`;
CREATE TABLE `disposal_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_code` varchar(50) NOT NULL,
  `inventory_item_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `reason` text NOT NULL,
  `inspection_notes` text,
  `disposal_method` enum('Auction','Donation','Recycling','Destruction','Trade-In','Other') DEFAULT NULL,
  `status` enum('Pending','Inspected','Approved','Rejected','Completed') DEFAULT 'Pending',
  `requested_by` int NOT NULL,
  `inspected_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `disposal_date` date DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_code` (`transaction_code`),
  KEY `inventory_item_id` (`inventory_item_id`),
  KEY `requested_by` (`requested_by`),
  KEY `inspected_by` (`inspected_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_disposal_status` (`status`),
  CONSTRAINT `disposal_requests_ibfk_1` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `disposal_requests_ibfk_2` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `disposal_requests_ibfk_3` FOREIGN KEY (`inspected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `disposal_requests_ibfk_4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `disposal_requests` (`id`, `transaction_code`, `inventory_item_id`, `quantity`, `reason`, `inspection_notes`, `disposal_method`, `status`, `requested_by`, `inspected_by`, `approved_by`, `disposal_date`, `notes`, `created_at`, `updated_at`) VALUES (1, 'DSP-SMP-001', 15, 10, 'HDMI cables with bent pins and exposed wiring', NULL, NULL, 'Pending', 3, NULL, NULL, NULL, 'Replacement cables already ordered', '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `disposal_requests` (`id`, `transaction_code`, `inventory_item_id`, `quantity`, `reason`, `inspection_notes`, `disposal_method`, `status`, `requested_by`, `inspected_by`, `approved_by`, `disposal_date`, `notes`, `created_at`, `updated_at`) VALUES (2, 'DSP-SMP-002', 19, 5, 'Scratched safety goggles beyond classroom use', 'Confirmed unusable — lenses scratched on all units', NULL, 'Inspected', 4, 2, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `disposal_requests` (`id`, `transaction_code`, `inventory_item_id`, `quantity`, `reason`, `inspection_notes`, `disposal_method`, `status`, `requested_by`, `inspected_by`, `approved_by`, `disposal_date`, `notes`, `created_at`, `updated_at`) VALUES (3, 'DSP-SMP-003', 13, 1, 'Network switch with intermittent port failures', NULL, 'Recycling', 'Approved', 3, 2, 1, NULL, 'E-waste recycling per CI policy', '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `disposal_requests` (`id`, `transaction_code`, `inventory_item_id`, `quantity`, `reason`, `inspection_notes`, `disposal_method`, `status`, `requested_by`, `inspected_by`, `approved_by`, `disposal_date`, `notes`, `created_at`, `updated_at`) VALUES (4, 'DSP-SMP-004', 23, 1, 'PA speaker with blown driver — repair uneconomical', NULL, NULL, 'Rejected', 5, NULL, 1, NULL, 'Sent for warranty repair instead', '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `disposal_requests` (`id`, `transaction_code`, `inventory_item_id`, `quantity`, `reason`, `inspection_notes`, `disposal_method`, `status`, `requested_by`, `inspected_by`, `approved_by`, `disposal_date`, `notes`, `created_at`, `updated_at`) VALUES (5, 'DSP-SMP-005', 1, 1, 'Torque wrench with broken ratchet mechanism', NULL, 'Destruction', 'Completed', 4, 1, 1, '2025-05-30', 'Tool destroyed per disposal committee approval', '2026-07-09 08:26:43', '2026-07-09 08:26:43');

DROP TABLE IF EXISTS `document_history`;
CREATE TABLE `document_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_type` enum('PAR','GRN','RDF','ABL','TRF','SAL') NOT NULL,
  `document_number` varchar(50) NOT NULL,
  `related_module` varchar(50) DEFAULT NULL,
  `related_transaction_id` int DEFAULT NULL,
  `generated_by` int DEFAULT NULL,
  `generated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `payload` json NOT NULL,
  `status` varchar(30) DEFAULT 'Generated',
  PRIMARY KEY (`id`),
  UNIQUE KEY `document_number` (`document_number`),
  KEY `generated_by` (`generated_by`),
  KEY `idx_doc_type` (`document_type`),
  KEY `idx_doc_related` (`related_module`,`related_transaction_id`),
  CONSTRAINT `document_history_ibfk_1` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (1, 'GRN', 'GRN-2026-000001', 'inventory', 1, 1, '2026-07-08 11:11:59', '[object Object]', 'Updated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (2, 'SAL', 'SAL-2026-000001', 'inventory', 1, 1, '2026-07-08 11:11:59', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (3, 'GRN', 'GRN-2026-000002', 'inventory', 2, 1, '2026-07-08 11:11:59', '[object Object]', 'Updated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (4, 'SAL', 'SAL-2026-000002', 'inventory', 2, 1, '2026-07-08 11:11:59', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (5, 'GRN', 'GRN-2026-000003', 'inventory', 3, 1, '2026-07-08 11:12:00', '[object Object]', 'Updated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (6, 'SAL', 'SAL-2026-000003', 'inventory', 3, 1, '2026-07-08 11:12:00', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (7, 'GRN', 'GRN-2026-000004', 'inventory', 4, 1, '2026-07-08 11:12:00', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (8, 'SAL', 'SAL-2026-000004', 'inventory', 4, 1, '2026-07-08 11:12:00', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (9, 'GRN', 'GRN-2026-000005', 'inventory', 5, 1, '2026-07-08 11:12:00', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (10, 'SAL', 'SAL-2026-000005', 'inventory', 5, 1, '2026-07-08 11:12:00', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (11, 'GRN', 'GRN-2026-000006', 'inventory', 7, 1, '2026-07-08 11:13:02', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (12, 'SAL', 'SAL-2026-000006', 'inventory', 7, 1, '2026-07-08 11:13:02', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (13, 'GRN', 'GRN-2026-000007', 'inventory', 8, 1, '2026-07-08 11:13:24', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (14, 'SAL', 'SAL-2026-000007', 'inventory', 8, 1, '2026-07-08 11:13:24', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (15, 'GRN', 'GRN-2026-000008', 'inventory', 9, 1, '2026-07-08 11:13:24', '[object Object]', 'Generated');
INSERT INTO `document_history` (`id`, `document_type`, `document_number`, `related_module`, `related_transaction_id`, `generated_by`, `generated_at`, `payload`, `status`) VALUES (16, 'SAL', 'SAL-2026-000008', 'inventory', 9, 1, '2026-07-08 11:13:24', '[object Object]', 'Generated');

DROP TABLE IF EXISTS `document_sequences`;
CREATE TABLE `document_sequences` (
  `document_type` varchar(10) NOT NULL,
  `year` int NOT NULL,
  `last_number` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`document_type`,`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `document_sequences` (`document_type`, `year`, `last_number`) VALUES ('GRN', 2026, 8);
INSERT INTO `document_sequences` (`document_type`, `year`, `last_number`) VALUES ('SAL', 2026, 8);

DROP TABLE IF EXISTS `inventory_items`;
CREATE TABLE `inventory_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_code` varchar(50) NOT NULL,
  `item_name` varchar(200) NOT NULL,
  `description` text,
  `department_id` int NOT NULL,
  `asset_classification` enum('Consumable','Semi-Durable','Non-Consumable (Fixed Asset)') DEFAULT 'Consumable',
  `material` varchar(50) DEFAULT NULL,
  `property_tag` varchar(50) DEFAULT NULL,
  `custodian_id` int DEFAULT NULL,
  `parent_asset_id` int DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `available_quantity` int NOT NULL DEFAULT '0',
  `unit` varchar(50) DEFAULT 'pcs',
  `supplier_id` int DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `acquisition_date` date DEFAULT NULL,
  `purchase_request_number` varchar(50) DEFAULT NULL,
  `purchase_order_number` varchar(50) DEFAULT NULL,
  `invoice_number` varchar(50) DEFAULT NULL,
  `unit_cost` decimal(12,2) DEFAULT NULL,
  `acquisition_cost` decimal(12,2) DEFAULT NULL,
  `condition` enum('New','Good','Fair','Poor','Damaged') DEFAULT 'Good',
  `status` enum('Available','Borrowed','Low Stock','Out of Stock','Under Maintenance','Disposed') DEFAULT 'Available',
  `location_id` int DEFAULT NULL,
  `low_stock_threshold` int DEFAULT '5',
  `maintenance_schedule` enum('Monthly','Quarterly','Semi-Annual','Annual') DEFAULT NULL,
  `next_maintenance_date` date DEFAULT NULL,
  `maintenance_status` enum('Scheduled','In Progress','Completed','Overdue') DEFAULT NULL,
  `service_provider` varchar(150) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `archived_at` timestamp NULL DEFAULT NULL,
  `archived_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_code` (`item_code`),
  UNIQUE KEY `property_tag` (`property_tag`),
  UNIQUE KEY `idx_inventory_property_tag` (`property_tag`),
  KEY `custodian_id` (`custodian_id`),
  KEY `parent_asset_id` (`parent_asset_id`),
  KEY `idx_inventory_department` (`department_id`),
  KEY `idx_inventory_supplier` (`supplier_id`),
  KEY `idx_inventory_location` (`location_id`),
  KEY `idx_inventory_status` (`status`),
  KEY `idx_inventory_items_archived` (`is_archived`,`archived_at`),
  CONSTRAINT `inventory_items_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `inventory_items_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inventory_items_ibfk_3` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inventory_items_ibfk_4` FOREIGN KEY (`custodian_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inventory_items_ibfk_5` FOREIGN KEY (`parent_asset_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (1, 'ENG-001', 'Torque Wrench Set (Metric)', 'Engineering department equipment — Torque Wrench Set (Metric)', 2, 'Semi-Durable', 'Metal', NULL, 4, NULL, NULL, NULL, 1, 1, 'pcs', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Good', 'Low Stock', 2, 5, NULL, NULL, NULL, NULL, '2026-07-08 11:11:59', '2026-07-09 08:26:43', 1, '2026-07-08 11:11:59', 1);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (2, 'ENG-002', 'Engineering Drawing Template Set', 'Updated description', 2, 'Semi-Durable', 'Plastic', NULL, 4, NULL, NULL, NULL, 1, 1, 'pcs', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Good', 'Low Stock', 2, 5, NULL, NULL, NULL, NULL, '2026-07-08 11:11:59', '2026-07-09 08:26:43', 1, '2026-07-08 11:11:59', 1);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (3, 'ENG-003', 'Digital Caliper 150mm', 'Engineering department equipment — Digital Caliper 150mm', 2, 'Semi-Durable', 'Metal', NULL, 4, NULL, NULL, NULL, 1, 1, 'pcs', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Good', 'Low Stock', 2, 5, NULL, NULL, NULL, NULL, '2026-07-08 11:12:00', '2026-07-09 08:26:43', 1, '2026-07-08 11:12:00', 1);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (4, 'ENG-004', 'Safety Helmet (Yellow)', 'Engineering department equipment — Safety Helmet (Yellow)', 2, 'Semi-Durable', 'Plastic', '2025-0170', 4, NULL, NULL, NULL, 1, 1, 'pcs', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Good', 'Available', 2, 5, NULL, NULL, NULL, NULL, '2026-07-08 11:12:00', '2026-07-09 08:26:43', 1, '2026-07-08 11:12:00', 1);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (5, 'ENG-005', 'Steel Measuring Tape 5m', 'Engineering department equipment — Steel Measuring Tape 5m', 2, 'Semi-Durable', 'Metal', '2025/0170', 4, NULL, NULL, NULL, 1, 1, 'pcs', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Good', 'Available', 2, 5, NULL, NULL, NULL, NULL, '2026-07-08 11:12:00', '2026-07-09 08:26:43', 1, '2026-07-08 11:12:00', 1);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (7, 'ENG-006', 'Cordless Drill Driver', 'Engineering department equipment — Cordless Drill Driver', 2, 'Semi-Durable', 'Metal', NULL, 4, NULL, NULL, NULL, 1, 1, 'pcs', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Good', 'Available', 2, 5, NULL, NULL, NULL, NULL, '2026-07-08 11:13:02', '2026-07-09 08:26:43', 1, '2026-07-08 11:13:02', 1);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (8, 'ENG-007', 'Workbench Vise 4-inch', 'Engineering department equipment — Workbench Vise 4-inch', 2, 'Semi-Durable', 'Metal', '2025-4026', 4, NULL, NULL, NULL, 1, 1, 'pcs', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Good', 'Available', 2, 5, NULL, NULL, NULL, NULL, '2026-07-08 11:13:24', '2026-07-09 08:26:43', 1, '2026-07-08 11:13:24', 1);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (9, 'ENG-008', 'Angle Grinder 4-inch', 'Engineering department equipment — Angle Grinder 4-inch', 2, 'Semi-Durable', 'Metal', '2025/4026', 4, NULL, NULL, NULL, 1, 1, 'pcs', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Good', 'Available', 2, 5, NULL, NULL, NULL, NULL, '2026-07-08 11:13:24', '2026-07-09 08:26:43', 1, '2026-07-08 11:13:24', 1);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (11, 'SMP-ICT-001', 'Lenovo ThinkPad E14 Laptop', 'Lenovo ThinkPad E14 Laptop — ICT department asset', 1, 'Non-Consumable (Fixed Asset)', NULL, 'CI-ICT-2025-001', 3, NULL, 'Lenovo', 'ThinkPad E14 Gen 5', 12, 9, 'units', 1, '2025-01-15', '2025-01-20', 'PR-2025-014', 'PO-2025-008', 'INV-TPS-2025-112', '48500.00', '582000.00', 'Good', 'Available', 1, 2, 'Annual', '2026-01-15', 'Scheduled', 'TechPro Solutions', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (12, 'SMP-ICT-002', 'Epson LCD Projector', 'Epson LCD Projector — ICT department asset', 1, 'Non-Consumable (Fixed Asset)', NULL, 'CI-ICT-2025-002', 3, NULL, 'Epson', 'EB-L210SW', 8, 5, 'units', 1, '2025-02-10', NULL, NULL, NULL, NULL, '32000.00', NULL, 'Good', 'Available', 1, 2, NULL, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (13, 'SMP-ICT-003', 'Cisco Network Switch 28-Port', 'Cisco Network Switch 28-Port — ICT department asset', 1, 'Non-Consumable (Fixed Asset)', NULL, 'CI-ICT-2025-003', 3, NULL, 'Cisco', 'SG350-28', 4, 2, 'units', 1, '2025-03-05', NULL, NULL, NULL, NULL, '28500.00', NULL, 'Good', 'Low Stock', 1, 2, NULL, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (14, 'SMP-ICT-004', '8GB DDR4 RAM Module', '8GB DDR4 RAM Module — ICT department asset', 1, 'Semi-Durable', NULL, NULL, 3, NULL, 'Kingston', 'KVR26N19S8/8', 20, 14, 'pcs', 1, '2025-04-01', NULL, NULL, NULL, NULL, '1800.00', NULL, 'New', 'Available', 4, 5, NULL, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (15, 'SMP-ICT-005', 'HDMI Cable 2m', 'HDMI Cable 2m — ICT department asset', 1, 'Semi-Durable', NULL, NULL, 3, NULL, 'Belkin', 'HDMI-2M', 30, 0, 'pcs', 1, '2025-04-15', NULL, NULL, NULL, NULL, NULL, NULL, 'Good', 'Out of Stock', 1, 5, NULL, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (16, 'SMP-ENG-001', 'MIG Welding Machine', 'MIG Welding Machine — Engineering department asset', 2, 'Non-Consumable (Fixed Asset)', NULL, 'CI-ENG-2025-001', 4, NULL, 'Lincoln Electric', 'Pro-MIG 180', 3, 2, 'units', 3, '2025-02-20', NULL, NULL, NULL, NULL, '65000.00', NULL, 'Good', 'Available', 2, 1, 'Semi-Annual', '2025-08-20', 'Scheduled', 'Lincoln Service Center', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (17, 'SMP-ENG-002', 'Digital Multimeter', 'Digital Multimeter — Engineering department asset', 2, 'Semi-Durable', NULL, NULL, 4, NULL, 'Fluke', '117', 15, 11, 'pcs', 3, '2025-03-01', NULL, NULL, NULL, NULL, '8500.00', NULL, 'Good', 'Available', 2, 3, NULL, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (18, 'SMP-ENG-003', 'Bench Grinder 6-inch', 'Bench Grinder 6-inch — Engineering department asset', 2, 'Non-Consumable (Fixed Asset)', NULL, 'CI-ENG-2025-002', 4, NULL, 'Bosch', 'GBG 60-20', 2, 1, 'units', 3, '2025-03-15', NULL, NULL, NULL, NULL, '12000.00', NULL, 'Good', 'Under Maintenance', 2, 1, NULL, NULL, 'In Progress', 'Bosch Authorized Service', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (19, 'SMP-ENG-004', 'Safety Goggles (Clear)', 'Safety Goggles (Clear) — Engineering department asset', 2, 'Semi-Durable', NULL, NULL, 4, NULL, '3M', 'SF201AF', 50, 8, 'pcs', 2, '2025-04-10', NULL, NULL, NULL, NULL, NULL, NULL, 'New', 'Low Stock', 2, 10, NULL, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (20, 'SMP-SHS-001', 'BenQ Classroom Projector', 'BenQ Classroom Projector — Senior High School department asset', 3, 'Non-Consumable (Fixed Asset)', NULL, 'CI-SHS-2025-001', 5, NULL, 'BenQ', 'MW560', 6, 4, 'units', 1, '2025-01-25', NULL, NULL, NULL, NULL, '28000.00', NULL, 'Good', 'Available', 3, 2, NULL, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (21, 'SMP-SHS-002', 'General Science Lab Kit', 'General Science Lab Kit — Senior High School department asset', 3, 'Semi-Durable', NULL, NULL, 5, NULL, 'Eisco', 'GS-KIT-100', 10, 7, 'sets', 3, '2025-02-05', NULL, NULL, NULL, NULL, '4500.00', NULL, 'Good', 'Available', 3, 2, NULL, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (22, 'SMP-SHS-003', 'Interactive Whiteboard 75-inch', 'Interactive Whiteboard 75-inch — Senior High School department asset', 3, 'Non-Consumable (Fixed Asset)', NULL, 'CI-SHS-2025-002', 5, NULL, 'Samsung', 'Flip Pro WM75B', 2, 2, 'units', 1, '2025-05-01', NULL, NULL, NULL, NULL, '185000.00', NULL, 'New', 'Available', 5, 1, 'Annual', '2026-05-01', 'Scheduled', 'Samsung Business Solutions', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (23, 'SMP-SHS-004', 'Portable PA Speaker System', 'Portable PA Speaker System — Senior High School department asset', 3, 'Semi-Durable', NULL, NULL, 5, NULL, 'JBL', 'EON ONE Compact', 4, 3, 'sets', 2, '2025-05-20', NULL, NULL, NULL, NULL, '22000.00', NULL, 'Good', 'Available', 5, 1, NULL, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `inventory_items` (`id`, `item_code`, `item_name`, `description`, `department_id`, `asset_classification`, `material`, `property_tag`, `custodian_id`, `parent_asset_id`, `brand`, `model`, `quantity`, `available_quantity`, `unit`, `supplier_id`, `purchase_date`, `acquisition_date`, `purchase_request_number`, `purchase_order_number`, `invoice_number`, `unit_cost`, `acquisition_cost`, `condition`, `status`, `location_id`, `low_stock_threshold`, `maintenance_schedule`, `next_maintenance_date`, `maintenance_status`, `service_provider`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (24, 'SMP-SHS-005', 'Celestron Digital Microscope', 'Celestron Digital Microscope — Senior High School department asset', 3, 'Non-Consumable (Fixed Asset)', NULL, 'CI-SHS-2025-003', 5, NULL, 'Celestron', 'LCD Digital II', 5, 3, 'units', 3, '2025-06-01', NULL, NULL, NULL, NULL, '18500.00', NULL, 'Good', 'Borrowed', 3, 1, NULL, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);

DROP TABLE IF EXISTS `locations`;
CREATE TABLE `locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `archived_at` timestamp NULL DEFAULT NULL,
  `archived_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_locations_archived` (`is_archived`,`archived_at`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `locations` (`id`, `name`, `description`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (1, 'Com Lab 1', NULL, '2026-07-08 10:54:33', '2026-07-08 10:54:33', 0, NULL, NULL);
INSERT INTO `locations` (`id`, `name`, `description`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (2, 'Engineering Workshop', 'Engineering tools and equipment room', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `locations` (`id`, `name`, `description`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (3, 'SHS Faculty Room', 'Senior High School faculty office', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `locations` (`id`, `name`, `description`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (4, 'Property Office Storage', 'Central property management storage', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `locations` (`id`, `name`, `description`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (5, 'Main Building Lobby', 'Lobby AV and display equipment', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);

DROP TABLE IF EXISTS `maintenance_records`;
CREATE TABLE `maintenance_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `inventory_item_id` int NOT NULL,
  `maintenance_type` enum('Preventive','Corrective','Emergency') DEFAULT 'Preventive',
  `scheduled_date` date NOT NULL,
  `completed_date` date DEFAULT NULL,
  `service_provider` varchar(150) DEFAULT NULL,
  `status` enum('Pending','Approved','Scheduled','Ongoing','Completed','Cancelled','Overdue','In Progress') DEFAULT 'Pending',
  `description` text,
  `cost` decimal(12,2) DEFAULT NULL,
  `performed_by` int DEFAULT NULL,
  `next_maintenance_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `transaction_code` varchar(50) DEFAULT NULL,
  `requested_by` int DEFAULT NULL,
  `requested_date` date DEFAULT NULL,
  `reported_problem` text,
  `priority` enum('Low','Medium','High') DEFAULT 'Medium',
  `technician` varchar(150) DEFAULT NULL,
  `admin_remarks` text,
  `completion_remarks` text,
  `rejection_reason` text,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_maintenance_transaction_code` (`transaction_code`),
  KEY `performed_by` (`performed_by`),
  KEY `idx_maintenance_item` (`inventory_item_id`),
  KEY `idx_maintenance_scheduled` (`scheduled_date`),
  CONSTRAINT `maintenance_records_ibfk_1` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `maintenance_records_ibfk_2` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `maintenance_records` (`id`, `inventory_item_id`, `maintenance_type`, `scheduled_date`, `completed_date`, `service_provider`, `status`, `description`, `cost`, `performed_by`, `next_maintenance_date`, `created_at`, `updated_at`, `transaction_code`, `requested_by`, `requested_date`, `reported_problem`, `priority`, `technician`, `admin_remarks`, `completion_remarks`, `rejection_reason`, `approved_by`, `approved_at`, `notes`) VALUES (1, 18, 'Corrective', '2025-06-15', NULL, 'Bosch Authorized Service', 'Pending', 'Bench grinder motor inspection and bearing replacement', NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 'MNT-SMP-001', 4, '2025-06-01', 'Grinder motor overheating during extended use', 'High', NULL, NULL, NULL, NULL, NULL, NULL, 'Bench grinder motor inspection and bearing replacement');
INSERT INTO `maintenance_records` (`id`, `inventory_item_id`, `maintenance_type`, `scheduled_date`, `completed_date`, `service_provider`, `status`, `description`, `cost`, `performed_by`, `next_maintenance_date`, `created_at`, `updated_at`, `transaction_code`, `requested_by`, `requested_date`, `reported_problem`, `priority`, `technician`, `admin_remarks`, `completion_remarks`, `rejection_reason`, `approved_by`, `approved_at`, `notes`) VALUES (2, 11, 'Preventive', '2025-06-10', NULL, 'TechPro Solutions', 'Approved', 'Dust cleaning, thermal paste replacement, and OS updates', NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 'MNT-SMP-002', 3, '2025-05-20', 'Annual preventive maintenance for laptop fleet', 'Medium', NULL, NULL, NULL, NULL, 1, '2025-06-10 11:00:00', 'Dust cleaning, thermal paste replacement, and OS updates');
INSERT INTO `maintenance_records` (`id`, `inventory_item_id`, `maintenance_type`, `scheduled_date`, `completed_date`, `service_provider`, `status`, `description`, `cost`, `performed_by`, `next_maintenance_date`, `created_at`, `updated_at`, `transaction_code`, `requested_by`, `requested_date`, `reported_problem`, `priority`, `technician`, `admin_remarks`, `completion_remarks`, `rejection_reason`, `approved_by`, `approved_at`, `notes`) VALUES (3, 20, 'Preventive', '2025-07-01', NULL, 'BenQ Authorized Service', 'Scheduled', 'Replace projector lamp before next school year', NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 'MNT-SMP-003', 2, '2025-05-01', 'Projector lamp hours approaching end of life', 'Low', NULL, NULL, NULL, NULL, 1, '2025-07-01 11:00:00', 'Replace projector lamp before next school year');
INSERT INTO `maintenance_records` (`id`, `inventory_item_id`, `maintenance_type`, `scheduled_date`, `completed_date`, `service_provider`, `status`, `description`, `cost`, `performed_by`, `next_maintenance_date`, `created_at`, `updated_at`, `transaction_code`, `requested_by`, `requested_date`, `reported_problem`, `priority`, `technician`, `admin_remarks`, `completion_remarks`, `rejection_reason`, `approved_by`, `approved_at`, `notes`) VALUES (4, 24, 'Corrective', '2025-04-10', '2025-04-12', 'LabEquip Supply Co.', 'Completed', 'Focus mechanism serviced and calibrated', '1500.00', 1, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 'MNT-SMP-004', 5, '2025-04-01', 'Microscope focus knob stiff — lubrication needed', 'Medium', NULL, NULL, NULL, NULL, 1, '2025-04-10 11:00:00', 'Focus mechanism serviced and calibrated');
INSERT INTO `maintenance_records` (`id`, `inventory_item_id`, `maintenance_type`, `scheduled_date`, `completed_date`, `service_provider`, `status`, `description`, `cost`, `performed_by`, `next_maintenance_date`, `created_at`, `updated_at`, `transaction_code`, `requested_by`, `requested_date`, `reported_problem`, `priority`, `technician`, `admin_remarks`, `completion_remarks`, `rejection_reason`, `approved_by`, `approved_at`, `notes`) VALUES (5, 15, 'Emergency', '2025-06-20', NULL, NULL, 'Cancelled', 'Damaged HDMI cables — disposal request filed separately', NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', 'MNT-SMP-005', 3, '2025-06-18', 'Bulk HDMI cables showing bent connectors', 'High', NULL, NULL, NULL, 'Items marked for disposal instead of repair', 1, '2025-06-20 11:00:00', 'Damaged HDMI cables — disposal request filed separately');

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) NOT NULL,
  `reference_id` int DEFAULT NULL,
  `link_url` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`),
  KEY `idx_notifications_user_read` (`user_id`,`is_read`),
  KEY `idx_notifications_created` (`created_at`),
  KEY `idx_notifications_type_ref` (`type`,`reference_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (1, 1, 'Location Added', 'Location Com Lab 1 was created.', 'location_created', 1, '/pages/manage-locations.html', 1, '2026-07-08 10:54:33', '2026-07-08 10:54:58');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (2, 1, 'User Created', 'User account Admin Created Custodian (admcreated_1783479785495) was created.', 'user_created', 6, '/pages/manage-users.html', 1, '2026-07-08 11:03:05', '2026-07-08 11:18:58');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (3, 2, 'New Inventory Item', 'A new inventory item has been added: Auto Code Test Item (ENG-001).', 'inventory_added', 1, '/pages/inventory.html', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (4, 2, 'Low Stock Alert', 'Auto Code Test Item (ENG-001) is now low in stock (1 remaining).', 'low_stock', 1, '/pages/inventory.html?id=1&low_stock=true', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (5, 4, 'Low Stock Alert', 'Auto Code Test Item (ENG-001) is now low in stock (1 remaining).', 'low_stock', 1, '/pages/inventory.html?id=1&low_stock=true', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (6, 6, 'Low Stock Alert', 'Auto Code Test Item (ENG-001) is now low in stock (1 remaining).', 'low_stock', 1, '/pages/inventory.html?id=1&low_stock=true', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (7, 2, 'Inventory Updated', 'Inventory item Auto Code Test Item Updated (ENG-001) has been updated.', 'inventory_updated', 1, '/pages/inventory.html', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (8, 2, 'Inventory Archived', 'Inventory item Auto Code Test Item Updated (ENG-001) has been archived.', 'inventory_archived', 1, '/pages/archive.html', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (9, 2, 'New Inventory Item', 'A new inventory item has been added: Description Test Item (ENG-002).', 'inventory_added', 2, '/pages/inventory.html', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (10, 2, 'Low Stock Alert', 'Description Test Item (ENG-002) is now low in stock (1 remaining).', 'low_stock', 2, '/pages/inventory.html?id=2&low_stock=true', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (11, 4, 'Low Stock Alert', 'Description Test Item (ENG-002) is now low in stock (1 remaining).', 'low_stock', 2, '/pages/inventory.html?id=2&low_stock=true', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (12, 6, 'Low Stock Alert', 'Description Test Item (ENG-002) is now low in stock (1 remaining).', 'low_stock', 2, '/pages/inventory.html?id=2&low_stock=true', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (13, 2, 'Inventory Updated', 'Inventory item Description Test Item (ENG-002) has been updated.', 'inventory_updated', 2, '/pages/inventory.html', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (14, 2, 'Inventory Archived', 'Inventory item Description Test Item (ENG-002) has been archived.', 'inventory_archived', 2, '/pages/archive.html', 0, '2026-07-08 11:11:59', '2026-07-08 11:11:59');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (15, 2, 'New Inventory Item', 'A new inventory item has been added: Material Test Item (ENG-003).', 'inventory_added', 3, '/pages/inventory.html', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (16, 2, 'Low Stock Alert', 'Material Test Item (ENG-003) is now low in stock (1 remaining).', 'low_stock', 3, '/pages/inventory.html?id=3&low_stock=true', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (17, 4, 'Low Stock Alert', 'Material Test Item (ENG-003) is now low in stock (1 remaining).', 'low_stock', 3, '/pages/inventory.html?id=3&low_stock=true', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (18, 6, 'Low Stock Alert', 'Material Test Item (ENG-003) is now low in stock (1 remaining).', 'low_stock', 3, '/pages/inventory.html?id=3&low_stock=true', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (19, 2, 'Inventory Updated', 'Inventory item Material Test Item (ENG-003) has been updated.', 'inventory_updated', 3, '/pages/inventory.html', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (20, 2, 'Inventory Archived', 'Inventory item Material Test Item (ENG-003) has been archived.', 'inventory_archived', 3, '/pages/archive.html', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (21, 2, 'New Inventory Item', 'A new inventory item has been added: Property Tag Hyphen Test (ENG-004).', 'inventory_added', 4, '/pages/inventory.html', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (22, 2, 'Low Stock Alert', 'Property Tag Hyphen Test (ENG-004) is now low in stock (1 remaining).', 'low_stock', 4, '/pages/inventory.html?id=4&low_stock=true', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (23, 4, 'Low Stock Alert', 'Property Tag Hyphen Test (ENG-004) is now low in stock (1 remaining).', 'low_stock', 4, '/pages/inventory.html?id=4&low_stock=true', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (24, 6, 'Low Stock Alert', 'Property Tag Hyphen Test (ENG-004) is now low in stock (1 remaining).', 'low_stock', 4, '/pages/inventory.html?id=4&low_stock=true', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (25, 2, 'New Inventory Item', 'A new inventory item has been added: Property Tag Slash Test (ENG-005).', 'inventory_added', 5, '/pages/inventory.html', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (26, 2, 'Low Stock Alert', 'Property Tag Slash Test (ENG-005) is now low in stock (1 remaining).', 'low_stock', 5, '/pages/inventory.html?id=5&low_stock=true', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (27, 4, 'Low Stock Alert', 'Property Tag Slash Test (ENG-005) is now low in stock (1 remaining).', 'low_stock', 5, '/pages/inventory.html?id=5&low_stock=true', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (28, 6, 'Low Stock Alert', 'Property Tag Slash Test (ENG-005) is now low in stock (1 remaining).', 'low_stock', 5, '/pages/inventory.html?id=5&low_stock=true', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (29, 2, 'Inventory Archived', 'Inventory item Property Tag Hyphen Test (ENG-004) has been archived.', 'inventory_archived', 4, '/pages/archive.html', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (30, 2, 'Inventory Archived', 'Inventory item Property Tag Slash Test (ENG-005) has been archived.', 'inventory_archived', 5, '/pages/archive.html', 0, '2026-07-08 11:12:00', '2026-07-08 11:12:00');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (31, 2, 'New Inventory Item', 'A new inventory item has been added: Semi-Durable Test Item (ENG-006).', 'inventory_added', 7, '/pages/inventory.html', 0, '2026-07-08 11:13:02', '2026-07-08 11:13:02');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (32, 2, 'Low Stock Alert', 'Semi-Durable Test Item (ENG-006) is now low in stock (1 remaining).', 'low_stock', 7, '/pages/inventory.html?id=7&low_stock=true', 0, '2026-07-08 11:13:02', '2026-07-08 11:13:02');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (33, 4, 'Low Stock Alert', 'Semi-Durable Test Item (ENG-006) is now low in stock (1 remaining).', 'low_stock', 7, '/pages/inventory.html?id=7&low_stock=true', 0, '2026-07-08 11:13:02', '2026-07-08 11:13:02');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (34, 6, 'Low Stock Alert', 'Semi-Durable Test Item (ENG-006) is now low in stock (1 remaining).', 'low_stock', 7, '/pages/inventory.html?id=7&low_stock=true', 0, '2026-07-08 11:13:02', '2026-07-08 11:13:02');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (35, 2, 'Inventory Archived', 'Inventory item Semi-Durable Test Item (ENG-006) has been archived.', 'inventory_archived', 7, '/pages/archive.html', 0, '2026-07-08 11:13:02', '2026-07-08 11:13:02');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (36, 2, 'New Inventory Item', 'A new inventory item has been added: Property Tag Hyphen Test (ENG-007).', 'inventory_added', 8, '/pages/inventory.html', 0, '2026-07-08 11:13:24', '2026-07-08 11:13:24');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (37, 2, 'Low Stock Alert', 'Property Tag Hyphen Test (ENG-007) is now low in stock (1 remaining).', 'low_stock', 8, '/pages/inventory.html?id=8&low_stock=true', 0, '2026-07-08 11:13:24', '2026-07-08 11:13:24');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (38, 4, 'Low Stock Alert', 'Property Tag Hyphen Test (ENG-007) is now low in stock (1 remaining).', 'low_stock', 8, '/pages/inventory.html?id=8&low_stock=true', 0, '2026-07-08 11:13:24', '2026-07-08 11:13:24');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (39, 6, 'Low Stock Alert', 'Property Tag Hyphen Test (ENG-007) is now low in stock (1 remaining).', 'low_stock', 8, '/pages/inventory.html?id=8&low_stock=true', 0, '2026-07-08 11:13:24', '2026-07-08 11:13:24');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (40, 2, 'New Inventory Item', 'A new inventory item has been added: Property Tag Slash Test (ENG-008).', 'inventory_added', 9, '/pages/inventory.html', 0, '2026-07-08 11:13:24', '2026-07-08 11:13:24');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (41, 2, 'Low Stock Alert', 'Property Tag Slash Test (ENG-008) is now low in stock (1 remaining).', 'low_stock', 9, '/pages/inventory.html?id=9&low_stock=true', 0, '2026-07-08 11:13:24', '2026-07-08 11:13:24');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (42, 4, 'Low Stock Alert', 'Property Tag Slash Test (ENG-008) is now low in stock (1 remaining).', 'low_stock', 9, '/pages/inventory.html?id=9&low_stock=true', 0, '2026-07-08 11:13:24', '2026-07-08 11:13:24');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (43, 6, 'Low Stock Alert', 'Property Tag Slash Test (ENG-008) is now low in stock (1 remaining).', 'low_stock', 9, '/pages/inventory.html?id=9&low_stock=true', 0, '2026-07-08 11:13:24', '2026-07-08 11:13:24');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (44, 2, 'Inventory Archived', 'Inventory item Property Tag Hyphen Test (ENG-007) has been archived.', 'inventory_archived', 8, '/pages/archive.html', 0, '2026-07-08 11:13:24', '2026-07-08 11:13:24');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (45, 2, 'Inventory Archived', 'Inventory item Property Tag Slash Test (ENG-008) has been archived.', 'inventory_archived', 9, '/pages/archive.html', 0, '2026-07-08 11:13:24', '2026-07-08 11:13:24');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (46, 1, 'User Archived', 'User account Admin Created Custodian (admcreated_1783479785495) was archived.', 'user_archived', 6, '/pages/archive.html', 1, '2026-07-08 11:19:03', '2026-07-08 11:19:33');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (47, 2, 'Low Stock Alert', 'SMP: SMP-ICT-003 Cisco Network Switch is below threshold (2 remaining).', 'low_stock', NULL, '/pages/inventory.html?low_stock=true', 0, '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (48, 2, 'Borrow Request Pending', 'SMP: BRW-SMP-001 awaits approval from ICT custodian.', 'borrow_pending', NULL, '/pages/orders.html', 0, '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (49, 3, 'Transfer Request Approved', 'SMP: TRF-SMP-002 RAM module transfer has been approved.', 'transfer_approved', NULL, '/pages/transfer-requests.html', 1, '2026-07-09 08:26:43', '2026-07-09 09:12:05');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (50, 4, 'Maintenance Scheduled', 'SMP: MNT-SMP-001 bench grinder repair scheduled for June 15.', 'maintenance_scheduled', NULL, '/pages/maintenance-requests.html', 0, '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (51, 5, 'Borrow Overdue', 'SMP: BRW-SMP-007 classroom projector is past expected return date.', 'borrow_overdue', NULL, '/pages/orders.html', 0, '2026-07-09 08:26:43', '2026-07-09 08:26:43');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (52, 1, 'Disposal Pending Inspection', 'SMP: DSP-SMP-001 HDMI cable disposal awaits inspection.', 'disposal_pending', NULL, '/pages/disposal-requests.html', 1, '2026-07-09 08:26:43', '2026-07-09 09:04:15');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (53, 2, 'Overdue Borrow Alert', 'Engineering Custodian''s borrow request (BRW-SMP-002) is overdue.', 'borrow_overdue_alert', 2, '/pages/orders.html?id=2', 1, '2026-07-09 08:27:03', '2026-07-09 09:04:45');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (54, 2, 'Overdue Borrow Alert', 'Senior High School Custodian''s borrow request (BRW-SMP-003) is overdue.', 'borrow_overdue_alert', 3, '/pages/orders.html?id=3', 0, '2026-07-09 08:27:03', '2026-07-09 08:27:03');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (55, 2, 'Overdue Borrow Alert', 'Senior High School Custodian''s borrow request (BRW-SMP-007) is overdue.', 'borrow_overdue_alert', 7, '/pages/orders.html?id=7', 0, '2026-07-09 08:27:03', '2026-07-09 08:27:03');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (56, 4, 'Item Overdue', 'Your borrowed item is overdue.', 'overdue', 2, '/pages/orders.html?id=2', 0, '2026-07-09 08:27:03', '2026-07-09 08:27:03');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (57, 5, 'Item Overdue', 'Your borrowed item is overdue.', 'overdue', 3, '/pages/orders.html?id=3', 0, '2026-07-09 08:27:04', '2026-07-09 08:27:04');
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `reference_id`, `link_url`, `is_read`, `created_at`, `updated_at`) VALUES (58, 5, 'Item Overdue', 'Your borrowed item is overdue.', 'overdue', 7, '/pages/orders.html?id=7', 0, '2026-07-09 08:27:04', '2026-07-09 08:27:04');

DROP TABLE IF EXISTS `return_transactions`;
CREATE TABLE `return_transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_code` varchar(50) NOT NULL,
  `borrow_transaction_id` int NOT NULL,
  `returned_by` int NOT NULL,
  `return_date` date NOT NULL,
  `condition` enum('Good','Fair','Damaged','Lost') DEFAULT 'Good',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_code` (`transaction_code`),
  KEY `borrow_transaction_id` (`borrow_transaction_id`),
  KEY `returned_by` (`returned_by`),
  KEY `idx_return_date` (`return_date`),
  CONSTRAINT `return_transactions_ibfk_1` FOREIGN KEY (`borrow_transaction_id`) REFERENCES `borrow_transactions` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `return_transactions_ibfk_2` FOREIGN KEY (`returned_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `return_transactions` (`id`, `transaction_code`, `borrow_transaction_id`, `returned_by`, `return_date`, `condition`, `notes`, `created_at`) VALUES (1, 'RTN-SMP-001', 4, 2, '2025-05-28', 'Good', 'Projector returned in working condition', '2026-07-09 08:26:43');
INSERT INTO `return_transactions` (`id`, `transaction_code`, `borrow_transaction_id`, `returned_by`, `return_date`, `condition`, `notes`, `created_at`) VALUES (2, 'RTN-SMP-002', 5, 3, '2025-05-12', 'Good', 'All laptops accounted for and functional', '2026-07-09 08:26:43');

DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=229 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `roles` (`id`, `name`, `description`, `created_at`) VALUES (1, 'admin', 'Full system access', '2026-07-04 07:37:59');
INSERT INTO `roles` (`id`, `name`, `description`, `created_at`) VALUES (3, 'Property Manager', 'Property management office access', '2026-07-04 07:41:58');
INSERT INTO `roles` (`id`, `name`, `description`, `created_at`) VALUES (120, 'Custodian', 'Asset custodian access scoped by department or laboratory assignment', '2026-07-08 09:07:09');

DROP TABLE IF EXISTS `suppliers`;
CREATE TABLE `suppliers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `address` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `archived_at` timestamp NULL DEFAULT NULL,
  `archived_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_suppliers_archived` (`is_archived`,`archived_at`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `suppliers` (`id`, `name`, `contact_person`, `phone`, `email`, `address`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (1, 'TechPro Solutions', 'Maria Santos', '09171234567', 'maria@techpro.com', 'Imus, Cavite', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `suppliers` (`id`, `name`, `contact_person`, `phone`, `email`, `address`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (2, 'Office Depot PH', 'Juan Dela Cruz', '09181234567', 'juan@officedepot.ph', 'Dasmariñas, Cavite', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `suppliers` (`id`, `name`, `contact_person`, `phone`, `email`, `address`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (3, 'LabEquip Supply Co.', 'Ana Reyes', '09191234567', 'ana@labequip.com', 'Bacoor, Cavite', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);
INSERT INTO `suppliers` (`id`, `name`, `contact_person`, `phone`, `email`, `address`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (4, 'Furniture World', 'Pedro Garcia', '09201234567', 'pedro@furnitureworld.com', 'Tagaytay, Cavite', '2026-07-09 08:26:43', '2026-07-09 08:26:43', 0, NULL, NULL);

DROP TABLE IF EXISTS `transfer_history`;
CREATE TABLE `transfer_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transfer_request_id` int NOT NULL,
  `inventory_item_id` int NOT NULL,
  `from_department_id` int DEFAULT NULL,
  `to_department_id` int DEFAULT NULL,
  `from_location_id` int DEFAULT NULL,
  `to_location_id` int DEFAULT NULL,
  `reason` text,
  `approved_by` int DEFAULT NULL,
  `transfer_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `transfer_request_id` (`transfer_request_id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_transfer_history_item` (`inventory_item_id`),
  CONSTRAINT `transfer_history_ibfk_1` FOREIGN KEY (`transfer_request_id`) REFERENCES `transfer_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transfer_history_ibfk_2` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transfer_history_ibfk_3` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `transfer_history` (`id`, `transfer_request_id`, `inventory_item_id`, `from_department_id`, `to_department_id`, `from_location_id`, `to_location_id`, `reason`, `approved_by`, `transfer_date`, `created_at`) VALUES (1, 4, 17, 2, 2, 2, 4, 'Spare multimeters for property audit calibration', 1, '2026-07-09 08:26:43', '2026-07-09 08:26:43');

DROP TABLE IF EXISTS `transfer_requests`;
CREATE TABLE `transfer_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_code` varchar(50) NOT NULL,
  `inventory_item_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `from_location_id` int DEFAULT NULL,
  `to_location_id` int DEFAULT NULL,
  `from_department_id` int DEFAULT NULL,
  `to_department_id` int DEFAULT NULL,
  `reason` text NOT NULL,
  `status` enum('Pending','Approved','Rejected','Completed') DEFAULT 'Pending',
  `requested_by` int NOT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `rejection_reason` text,
  `request_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_code` (`transaction_code`),
  KEY `inventory_item_id` (`inventory_item_id`),
  KEY `from_location_id` (`from_location_id`),
  KEY `to_location_id` (`to_location_id`),
  KEY `from_department_id` (`from_department_id`),
  KEY `to_department_id` (`to_department_id`),
  KEY `requested_by` (`requested_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_transfer_status` (`status`),
  CONSTRAINT `transfer_requests_ibfk_1` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `transfer_requests_ibfk_2` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transfer_requests_ibfk_3` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transfer_requests_ibfk_4` FOREIGN KEY (`from_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transfer_requests_ibfk_5` FOREIGN KEY (`to_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transfer_requests_ibfk_6` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `transfer_requests_ibfk_7` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `transfer_requests` (`id`, `transaction_code`, `inventory_item_id`, `quantity`, `from_location_id`, `to_location_id`, `from_department_id`, `to_department_id`, `reason`, `status`, `requested_by`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`, `rejection_reason`, `request_date`) VALUES (1, 'TRF-SMP-001', 11, 1, 1, 3, 1, 3, 'Temporary laptop loan to SHS faculty for research week', 'Pending', 3, NULL, NULL, NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', NULL, '2025-06-01');
INSERT INTO `transfer_requests` (`id`, `transaction_code`, `inventory_item_id`, `quantity`, `from_location_id`, `to_location_id`, `from_department_id`, `to_department_id`, `reason`, `status`, `requested_by`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`, `rejection_reason`, `request_date`) VALUES (2, 'TRF-SMP-002', 14, 4, 4, 1, 1, 1, 'RAM modules needed for Com Lab 1 PC upgrades', 'Approved', 2, 1, '2025-06-01 10:00:00', NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', NULL, '2025-06-01');
INSERT INTO `transfer_requests` (`id`, `transaction_code`, `inventory_item_id`, `quantity`, `from_location_id`, `to_location_id`, `from_department_id`, `to_department_id`, `reason`, `status`, `requested_by`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`, `rejection_reason`, `request_date`) VALUES (3, 'TRF-SMP-003', 20, 1, 3, 5, 3, 3, 'Projector for lobby school assembly', 'Rejected', 5, 1, '2025-06-01 10:00:00', 'Item currently on borrow — transfer deferred', '2026-07-09 08:26:43', '2026-07-09 08:26:43', NULL, '2025-06-01');
INSERT INTO `transfer_requests` (`id`, `transaction_code`, `inventory_item_id`, `quantity`, `from_location_id`, `to_location_id`, `from_department_id`, `to_department_id`, `reason`, `status`, `requested_by`, `approved_by`, `approved_at`, `notes`, `created_at`, `updated_at`, `rejection_reason`, `request_date`) VALUES (4, 'TRF-SMP-004', 17, 3, 2, 4, 2, 2, 'Spare multimeters for property audit calibration', 'Completed', 2, 1, '2025-06-01 10:00:00', NULL, '2026-07-09 08:26:43', '2026-07-09 08:26:43', NULL, '2025-06-01');

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `assigned_department_id` int DEFAULT NULL,
  `assigned_location_id` int DEFAULT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `archived_at` timestamp NULL DEFAULT NULL,
  `archived_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  KEY `idx_users_archived` (`is_archived`,`archived_at`),
  KEY `fk_users_assigned_department` (`assigned_department_id`),
  KEY `fk_users_assigned_location` (`assigned_location_id`),
  CONSTRAINT `fk_users_assigned_department` FOREIGN KEY (`assigned_department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_users_assigned_location` FOREIGN KEY (`assigned_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `users` (`id`, `role_id`, `assigned_department_id`, `assigned_location_id`, `username`, `email`, `password_hash`, `full_name`, `profile_image`, `is_active`, `last_login`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (1, 1, NULL, NULL, 'admin', 'admin@caviteinstitute.edu', '$2a$10$UxMSEk//q7uWVtYUpPcDLO4QvnXFGDOLHHkgaURVJOReyqFK1Eo/u', 'System Administrator', NULL, 1, '2026-07-09 10:20:28', '2026-07-04 07:37:59', '2026-07-09 10:20:28', 0, NULL, NULL);
INSERT INTO `users` (`id`, `role_id`, `assigned_department_id`, `assigned_location_id`, `username`, `email`, `password_hash`, `full_name`, `profile_image`, `is_active`, `last_login`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (2, 3, NULL, NULL, 'pm_test', 'pm_test@caviteinstitute.edu.ph', '$2a$10$Ksxuy.LWhh.Xg.iErwwDbORSL/f1JCwPdXr.VrV2kU/6guokpO0o6', 'Test Property Manager', NULL, 1, '2026-07-09 10:20:28', '2026-07-08 10:33:35', '2026-07-09 10:20:28', 0, NULL, NULL);
INSERT INTO `users` (`id`, `role_id`, `assigned_department_id`, `assigned_location_id`, `username`, `email`, `password_hash`, `full_name`, `profile_image`, `is_active`, `last_login`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (3, 120, 1, NULL, 'ict_custodian', 'ict_custodian@caviteinstitute.edu.ph', '$2a$10$oA2M27tbnAwHZIlZjjEusexXYvslJa8CZs4Cc4EPFixDqWoIPrC6i', 'ICT Custodian', NULL, 1, '2026-07-09 10:20:28', '2026-07-08 10:33:35', '2026-07-09 10:20:28', 0, NULL, NULL);
INSERT INTO `users` (`id`, `role_id`, `assigned_department_id`, `assigned_location_id`, `username`, `email`, `password_hash`, `full_name`, `profile_image`, `is_active`, `last_login`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (4, 120, 2, NULL, 'eng_custodian', 'eng_custodian@caviteinstitute.edu.ph', '$2a$10$EYVxWH9VoeZK.nPyFpVr0ORTjNX65rkqrw1OVrbkIincJdNM0Rgoa', 'Engineering Custodian', NULL, 1, '2026-07-09 09:19:02', '2026-07-08 10:33:35', '2026-07-09 09:19:02', 0, NULL, NULL);
INSERT INTO `users` (`id`, `role_id`, `assigned_department_id`, `assigned_location_id`, `username`, `email`, `password_hash`, `full_name`, `profile_image`, `is_active`, `last_login`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (5, 120, 3, NULL, 'shs_custodian', 'shs_custodian@caviteinstitute.edu.ph', '$2a$10$Cr099Jb6OBfugB0bUrrkie41SX8rvxFK76w0IcD0WobFyms34n6Jq', 'Senior High School Custodian', NULL, 1, '2026-07-09 09:16:43', '2026-07-08 10:33:35', '2026-07-09 09:16:43', 0, NULL, NULL);
INSERT INTO `users` (`id`, `role_id`, `assigned_department_id`, `assigned_location_id`, `username`, `email`, `password_hash`, `full_name`, `profile_image`, `is_active`, `last_login`, `created_at`, `updated_at`, `is_archived`, `archived_at`, `archived_by`) VALUES (6, 120, 2, NULL, 'admcreated_1783479785495', 'admcreated_1783479785495@caviteinstitute.edu.ph', '$2a$10$gJj1LiB4nI.Qk7sOkXWPf.NhS6Ab19Oii20YppntKGJad7VuDClQ.', 'Admin Created Custodian', NULL, 0, NULL, '2026-07-08 11:03:05', '2026-07-08 11:19:03', 1, '2026-07-08 11:19:03', 1);

SET FOREIGN_KEY_CHECKS=1;
