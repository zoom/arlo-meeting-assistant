#!/bin/bash
# Arlo Meeting Assistant - Setup Verification Script
# Verifies that your local development environment is properly configured

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
CHECKS_TOTAL=0
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

print_header() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}   ${BLUE}Arlo Meeting Assistant - Setup Verification${NC}     ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}\n"
}

print_section() {
    echo -e "\n${BLUE}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check() {
    local message="$1"
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    echo -n "  ⟳ $message... "
}

pass() {
    echo -e "${GREEN}✓${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
    if [ -n "$1" ]; then
        echo -e "    ${GREEN}└─${NC} $1"
    fi
}

fail() {
    echo -e "${RED}✗${NC}"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
    if [ -n "$1" ]; then
        echo -e "    ${RED}└─${NC} $1"
    fi
}

warn() {
    echo -e "${YELLOW}⚠${NC}"
    CHECKS_WARNING=$((CHECKS_WARNING + 1))
    if [ -n "$1" ]; then
        echo -e "    ${YELLOW}└─${NC} $1"
    fi
}

print_summary() {
    echo -e "\n${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}                    ${BLUE}Summary${NC}                         ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo -e "  Total Checks: ${CHECKS_TOTAL}"
    echo -e "  ${GREEN}Passed: ${CHECKS_PASSED}${NC}"
    echo -e "  ${RED}Failed: ${CHECKS_FAILED}${NC}"
    echo -e "  ${YELLOW}Warnings: ${CHECKS_WARNING}${NC}"

    if [ $CHECKS_FAILED -eq 0 ] && [ $CHECKS_WARNING -eq 0 ]; then
        echo -e "\n${GREEN}✅ Your environment is ready! Run: docker-compose up -d${NC}\n"
        exit 0
    elif [ $CHECKS_FAILED -eq 0 ]; then
        echo -e "\n${YELLOW}⚠️  Your environment is mostly ready, but check the warnings above${NC}\n"
        exit 0
    else
        echo -e "\n${RED}❌ Setup verification failed. Please fix the issues above${NC}\n"
        exit 1
    fi
}

# Check Prerequisites
check_nodejs() {
    print_section "Prerequisites"

    check "Node.js installed"
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | sed 's/v//')
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
        if [ "$MAJOR_VERSION" -ge 20 ]; then
            pass "Node.js $NODE_VERSION (✓ v20+)"
        else
            fail "Node.js $NODE_VERSION (Need v20+)"
        fi
    else
        fail "Node.js not found. Install from https://nodejs.org/"
    fi

    check "npm installed"
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        pass "npm $NPM_VERSION"
    else
        fail "npm not found"
    fi
}

check_docker() {
    check "Docker installed"
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
        pass "Docker $DOCKER_VERSION"
    else
        fail "Docker not found. Install from https://www.docker.com/"
    fi

    check "Docker Compose installed"
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        pass "Docker Compose installed"
    else
        fail "Docker Compose not found"
    fi

    check "Docker daemon running"
    if docker ps &> /dev/null; then
        pass "Docker daemon is active"
    else
        fail "Docker daemon is not running. Start Docker Desktop."
    fi
}

check_env_files() {
    print_section "Configuration Files"

    check ".env file exists"
    if [ -f ".env" ]; then
        pass "Found .env"
    else
        fail ".env not found. Copy from .env.example"
    fi

    if [ -f ".env" ]; then
        check "ZOOM_CLIENT_ID configured"
        if grep -q "^ZOOM_CLIENT_ID=.\+$" .env && ! grep -q "your_client_id" .env; then
            pass "Configured"
        else
            fail "Not configured. Get from Zoom Marketplace"
        fi

        check "SESSION_SECRET configured"
        if grep -q "^SESSION_SECRET=.\+$" .env && [ $(grep "^SESSION_SECRET=" .env | awk -F= '{print length($2)}') -ge 32 ]; then
            pass "Configured"
        else
            warn "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        fi
    fi
}

check_dependencies() {
    print_section "Project Dependencies"

    check "backend dependencies"
    if [ -d "backend/node_modules" ]; then
        pass "Installed"
    else
        warn "Run: cd backend && npm install"
    fi

    check "frontend dependencies"
    if [ -d "frontend/node_modules" ]; then
        pass "Installed"
    else
        warn "Run: cd frontend && npm install"
    fi

    check "cookie-parser in backend"
    if grep -q "cookie-parser" backend/package.json 2>/dev/null; then
        pass "Included"
    else
        fail "Missing. Run: cd backend && npm install cookie-parser"
    fi
}

check_database() {
    print_section "Database Configuration"

    check "Prisma schema exists"
    if [ -f "backend/prisma/schema.prisma" ]; then
        pass "Found"
    else
        fail "backend/prisma/schema.prisma not found"
    fi

    check "Prisma migrations exist"
    if [ -d "backend/prisma/migrations" ] && [ "$(ls -A backend/prisma/migrations 2>/dev/null)" ]; then
        pass "Found"
    else
        fail "No migrations found"
    fi
}

check_documentation() {
    print_section "Documentation & Assets"

    check "README.md"
    [ -f "README.md" ] && pass "Found" || fail "Not found"

    check "CONTRIBUTING.md"
    [ -f "CONTRIBUTING.md" ] && pass "Found" || warn "Not found (optional)"

    check "LICENSE"
    [ -f "LICENSE" ] && pass "Found" || warn "Not found (optional)"

    check "Arlo the Owl image"
    if [ -f "docs/assets/arlo-the-owl.png" ]; then
        pass "Found 🦉"
    else
        warn "Not found (optional, but makes README look nice!)"
    fi
}

# Main execution
main() {
    print_header
    check_nodejs
    check_docker
    check_env_files
    check_dependencies
    check_database
    check_documentation
    print_summary
}

main
