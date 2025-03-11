from .models import SystemLog, ModeratorAction

def log_system_event(level, type, action, user=None, details=None, ip_address=None, user_agent=None):
    """
    Utility function to create system logs
    
    Args:
        level (str): Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        type (str): Log type (AUTH, USER, CONTENT, SYSTEM, ADMIN)
        action (str): Description of the action
        user (User, optional): User who performed the action
        details (dict, optional): Additional details about the action
        ip_address (str, optional): IP address of the request
        user_agent (str, optional): User agent of the request
    """
    return SystemLog.objects.create(
        level=level.upper(),
        type=type.upper(),
        action=action,
        user=user,
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent
    )

def log_moderator_action(moderator, action_type, target_user, reason, details=None):
    """
    Utility function to create moderator action logs
    
    Args:
        moderator (User): Moderator who performed the action
        action_type (str): Type of action (POST_REMOVE, POST_RESTORE, USER_WARN, etc.)
        target_user (User): User who was the target of the action
        reason (str): Reason for the action
        details (dict, optional): Additional details about the action
    """
    return ModeratorAction.objects.create(
        moderator=moderator,
        action_type=action_type.upper(),
        target_user=target_user,
        reason=reason,
        details=details or {}
    )

# Example usage:
"""
from logging.utils import log_system_event, log_moderator_action

# Log a system event
log_system_event(
    level='INFO',
    type='USER',
    action='User logged in',
    user=request.user,
    details={'method': 'oauth'},
    ip_address=request.META.get('REMOTE_ADDR'),
    user_agent=request.META.get('HTTP_USER_AGENT')
)

# Log a moderator action
log_moderator_action(
    moderator=request.user,
    action_type='USER_WARN',
    target_user=user,
    reason='Inappropriate content',
    details={'content_id': '123'}
)
""" 